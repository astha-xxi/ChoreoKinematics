export default function MetricCard({label,value,unit="",hint}:{label:string;value:string|number;unit?:string;hint?:string}){
  return <div className="metric-card"><span>{label}</span><strong>{value}{unit&&<small>{unit}</small>}</strong>{hint&&<em>{hint}</em>}</div>
}
