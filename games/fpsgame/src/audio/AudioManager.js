export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.limiter = null;
    this.noiseBuffers = new Map();
    this.shotsPlayed = 0;
    this.activeWeaponVoices = 0;
    this.peakWeaponVoices = 0;
    this.traversalSounds = 0;
    this.footstepsPlayed = 0;
    this.lastTraversalSound = null;
    this.confirmedHits = 0;
    this.confirmedKills = 0;
    this.hurtCues = 0;
    this.audioUnavailable = false;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume?.().catch?.(()=>{});
      return true;
    }
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) { this.audioUnavailable=true;return false; }
    try {
      this.ctx = new AudioContextCtor();
      this.master = this.ctx.createGain();
      this.master.gain.value = .14;
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -8;
      this.limiter.knee.value = 7;
      this.limiter.ratio.value = 14;
      this.limiter.attack.value = .002;
      this.limiter.release.value = .11;
      this.master.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);
      this.audioUnavailable=false;
      return true;
    } catch {
      this.ctx?.close?.()?.catch?.(()=>{});
      this.ctx=null;this.master=null;this.limiter=null;
      this.audioUnavailable=true;
      return false;
    }
  }

  getNoiseBuffer(key, duration) {
    if (!this.ctx) return null;
    const cacheKey = `${key}:${duration.toFixed(3)}:${this.ctx.sampleRate}`;
    if (this.noiseBuffers.has(cacheKey)) return this.noiseBuffers.get(cacheKey);
    const length = Math.max(1, Math.ceil(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 2166136261;
    for (let i=0;i<cacheKey.length;i++) seed = Math.imul(seed ^ cacheKey.charCodeAt(i), 16777619) >>> 0;
    for (let i=0;i<length;i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const random = (seed / 4294967295) * 2 - 1;
      data[i] = random * (1 - i / length);
    }
    this.noiseBuffers.set(cacheKey, buffer);
    return buffer;
  }

  trackWeaponVoice(node) {
    this.activeWeaponVoices++;
    this.peakWeaponVoices = Math.max(this.peakWeaponVoices, this.activeWeaponVoices);
    node.addEventListener?.('ended', () => {
      this.activeWeaponVoices = Math.max(0, this.activeWeaponVoices - 1);
    }, { once:true });
  }

  tone(freq=100, duration=.08, gain=.2, type='square', delay=0, trackWeapon=false) {
    if (!this.ctx || !this.master) return;
    const start = this.ctx.currentTime + Math.max(0, delay);
    const oscillator = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, freq*.55), start + duration);
    gainNode.gain.setValueAtTime(Math.max(.0001, gain), start);
    gainNode.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gainNode);
    gainNode.connect(this.master);
    if (trackWeapon) this.trackWeaponVoice(oscillator);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  noise(duration=.09, gain=.32, highpass=700, delay=0, key='noise', trackWeapon=false) {
    if (!this.ctx || !this.master) return;
    const buffer = this.getNoiseBuffer(key, duration);
    if (!buffer) return;
    const start = this.ctx.currentTime + Math.max(0, delay);
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();
    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    gainNode.gain.value = gain;
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.master);
    if (trackWeapon) this.trackWeaponVoice(source);
    source.start(start);
  }

  traversal(kind) {
    if(!this.ctx || this.ctx.state !== 'running') return false;
    if(kind==='STEP'){
      this.footstepsPlayed++;
      const alternate=this.footstepsPlayed%2===0;
      this.noise(.058,.035,alternate?460:550,0,'step-concrete');
      this.tone(alternate?96:110,.037,.016,'sine');
    }else{
      const table={
        SLIDE:[.17,.055,420,110], VAULT:[.12,.048,950,164],
        MANTLE:[.22,.048,520,115], LEDGE_HANG:[.10,.035,650,130],
        WALL_RUN:[.14,.045,730,145], WALL_KICK:[.13,.055,950,185],
        LANDING:[.11,.050,270,85], DROP:[.095,.032,620,95]
      };
      const cfg=table[kind];
      if(!cfg)return false;
      this.noise(cfg[0],cfg[1],cfg[2],0,'traversal-'+kind);
      this.tone(cfg[3],Math.max(.05,cfg[0]*.64),.024,'triangle');
    }
    this.traversalSounds++;
    this.lastTraversalSound=kind;
    return true;
  }

  gunshot(kind='rifle') {
    if (!this.ctx) return;
    this.shotsPlayed++;
    if(kind==='pistol'){
      this.noise(.026,.17,2350,0,'pistol-transient',true);
      this.tone(140,.065,.070,'sawtooth',0,true);
      this.tone(810,.022,.020,'square',.009,true);
      this.noise(.105,.042,550,.023,'pistol-tail',true);
      return;
    }
    this.noise(.035,.24,1900,0,'weapon-transient',true);
    this.tone(82,.09,.11,'sawtooth',0,true);
    this.tone(690,.022,.026,'square',.012,true);
    this.noise(.16,.07,380,.025,'station-tail',true);
    this.tone(128,.15,.025,'sine',.045,true);
  }

  melee(result='miss') {
    if(!this.ctx||this.ctx.state!=='running')return false;
    this.noise(.095,.042,880,0,'knife-swipe');
    this.tone(210,.058,.026,'triangle');
    if(result==='enemy')this.noise(.045,.05,420,.04,'knife-contact');
    else if(result==='blocked')this.noise(.036,.043,1900,.04,'knife-clink');
    return true;
  }

  impact(surface) {
    const metal = surface === 'metal';
    this.noise(metal?.05:.08, metal?.24:.14, metal?2500:800, 0, metal?'impact-metal':'impact-solid');
  }

  confirmation(kind) {
    if(!this.ctx||this.ctx.state!=='running')return false;
    if(kind==='KILL'){
      this.confirmedKills++;
      this.tone(820,.08,.026,'sine');
      this.tone(1040,.11,.025,'sine',.047);
    }else if(kind==='HEAD'){
      this.confirmedHits++;
      this.tone(850,.095,.028,'triangle');
    }else if(kind==='HIT'){
      this.confirmedHits++;
      this.tone(540,.055,.018,'sine');
    }else if(kind==='HURT'){
      this.hurtCues++;
      this.tone(130,.11,.023,'triangle');
    }else return false;
    return true;
  }

  reload() {
    this.tone(520,.035,.06,'square');
    this.tone(330,.05,.06,'square',.42);
  }

  trainHorn() {
    this.tone(165,.7,.06,'sine');
    this.tone(138,.8,.045,'sine',.35);
  }

  announce() {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance('次の電車がまいります。危険ですので、黄色い線の内側までお下がりください。');
    utterance.lang='ja-JP';
    utterance.rate=.92;
    utterance.volume=.55;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  snapshot() {
    return {
      unlocked: !!this.ctx,
      audioUnavailable:this.audioUnavailable,
      contextState: this.ctx?.state ?? 'unavailable',
      cachedNoiseBuffers: this.noiseBuffers.size,
      shotsPlayed: this.shotsPlayed,
      activeWeaponVoices: this.activeWeaponVoices,
      peakWeaponVoices: this.peakWeaponVoices,
      masterGain: this.master?.gain?.value ?? 0,
      limiter: !!this.limiter,
      traversalSounds:this.traversalSounds,
      footstepsPlayed:this.footstepsPlayed,
      lastTraversalSound:this.lastTraversalSound,
      confirmedHits:this.confirmedHits,confirmedKills:this.confirmedKills,hurtCues:this.hurtCues
    };
  }
}
