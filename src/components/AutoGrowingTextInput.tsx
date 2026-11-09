import {useLayoutEffect,useRef,useState} from "react";
import {Platform,TextInput,type TextInputProps} from "react-native";

type Props=Omit<TextInputProps,"multiline"|"onContentSizeChange">&{minimumHeight?:number};

/** Expand the editor; let the existing page scroll instead of nesting text scrollbars. */
export function AutoGrowingTextInput({minimumHeight=180,style,value,...props}:Props){
  const input=useRef<TextInput>(null);
  const [height,setHeight]=useState(minimumHeight);
  useLayoutEffect(()=>{
    if(Platform.OS!=="web")return;
    const node=input.current as unknown as HTMLTextAreaElement|null;
    if(!node||!node.style)return;
    let width=0;
    const resize=()=>{
      if(!node.clientWidth)return;
      width=node.clientWidth;
      // Keep the measured width while the page scrollbar may disappear briefly.
      const inlineWidth=node.style.width;
      node.style.width=`${node.getBoundingClientRect().width}px`;
      node.style.height="auto";
      const next=Math.max(minimumHeight,Math.ceil(node.scrollHeight+node.offsetHeight-node.clientHeight));
      node.style.height=`${next}px`;
      node.style.width=inlineWidth;
      setHeight(next);
    };
    resize();
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(()=>{if(node.clientWidth!==width)resize();}):null;
    observer?.observe(node);
    return ()=>observer?.disconnect();
  },[value,minimumHeight]);
  return <TextInput {...props} ref={input} value={value} multiline scrollEnabled={false}
    onContentSizeChange={event=>{if(Platform.OS!=="web")setHeight(Math.max(minimumHeight,Math.ceil(event.nativeEvent.contentSize.height+2)));}}
    style={[style,{width:"100%",height,minHeight:minimumHeight,overflow:"hidden"}]}/>;
}
