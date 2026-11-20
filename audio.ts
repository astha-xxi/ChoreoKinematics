export type BeatEvent = { time: number; strength: number };
export async function analyzeAudio(file: File): Promise<{buffer:AudioBuffer; beats:BeatEvent[]}> {
  const context = new AudioContext();
  const buffer = await context.decodeAudioData(await file.arrayBuffer());
  const data = buffer.getChannelData(0);
  const hop = 512, window = 1024, energies:number[]=[];
  for(let i=0;i<data.length-window;i+=hop){
    let e=0; for(let j=0;j<window;j++) e+=data[i+j]*data[i+j];
    energies.push(Math.sqrt(e/window));
  }
  const beats:BeatEvent[]=[];
  for(let i=4;i<energies.length-2;i++){
    const baseline=energies.slice(i-4,i).reduce((a,b)=>a+b,0)/4;
    const strength=energies[i]-baseline;
    if(strength>Math.max(.012,baseline*.55) && (beats.length===0 || i*hop/buffer.sampleRate-beats[beats.length-1].time>.22)){
      beats.push({time:i*hop/buffer.sampleRate,strength});
    }
  }
  await context.close();
  return {buffer,beats};
}
