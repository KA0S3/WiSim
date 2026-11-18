import {useEffect,useRef,useState} from 'react'

export function NumberField({label,value,unit,onChange,min=0,max,optional=false,onClear}:{label:string;value:number | undefined;unit:string;onChange:(n:number)=>void;optional?:boolean;onClear?:()=>void;min?:number;max?:number}){
 const [text,setText]=useState(value === undefined ? '' : String(value));const focused=useRef(false)
 useEffect(()=>{if(!focused.current)setText(value === undefined ? '' : String(value))},[value])
 return <label className="field"><span>{label}</span><div className="number-input"><input aria-label={label} type="number" placeholder={optional?'Automatic':undefined} value={text} min={min} max={max} step="any" onFocus={()=>{focused.current=true}} onBlur={()=>{focused.current=false;setText(value === undefined ? '' : String(value))}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}} onChange={e=>{setText(e.target.value);if(e.target.value.trim()===''){if(optional)onClear?.();return;}const v=Number(e.target.value);if(Number.isFinite(v)&&v>=min&&(max===undefined||v<=max))onChange(v)}}/><span>{unit}</span></div></label>
}
