import { useEffect, useState } from 'react';

let push: (msg: string) => void = () => {};
export const toast = (msg: string) => push(msg);

export function Toaster() {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => {
    push = (text) => setMsg({ text, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(t);
  }, [msg]);
  return msg ? <div key={msg.id} className="toast glass">{msg.text}</div> : null;
}
