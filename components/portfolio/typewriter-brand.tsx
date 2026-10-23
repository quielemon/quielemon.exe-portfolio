"use client";
import { useEffect, useState } from "react";
export default function TypewriterBrand({ animate }: { animate: boolean }) {
 const [text, setText] = useState("QA.EXE");
 useEffect(() => {
  if (!animate) { setText("QUIELEMON"); return; }
  const words = ["QA.EXE", "QUIELEMON"];
  let index = 0, count = words[0].length, removing = true, timer: ReturnType<typeof setTimeout>;
  setText(words[0]);
  const tick = () => {
   if (removing) {
    count--; setText(words[index].slice(0, count));
    if (count === 0) { removing = false; index = (index + 1) % words.length; timer = setTimeout(tick, 350); }
    else timer = setTimeout(tick, 90);
   } else {
    count++; setText(words[index].slice(0, count));
    if (count === words[index].length) { removing = true; timer = setTimeout(tick, 3200); }
    else timer = setTimeout(tick, 135);
   }
  };
  timer = setTimeout(tick, 2400);
  return () => clearTimeout(timer);
 }, [animate]);
 return <strong className="typewriter-brand" aria-label="QA.EXE — Quielemon"><span aria-hidden="true">{text}<span className="brand-cursor">_</span></span></strong>;
}
