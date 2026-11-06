import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Search, Filter, RefreshCw, Star, Send, Clock3, Plus, LogOut, X, Upload, CalendarClock, Mail } from "lucide-react";
import { api, Email, User } from "./api";

type Tab = "scheduled" | "sent";
export default function App() {
  const [user,setUser]=useState<User|null>(null);
  const [tab,setTab]=useState<Tab>("scheduled");
  const [emails,setEmails]=useState<Email[]>([]);
  const [loading,setLoading]=useState(false);
  const [query,setQuery]=useState("");
  const [compose,setCompose]=useState(false);
  const [error,setError]=useState("");
  const [toast,setToast]=useState("");
  const [subject,setSubject]=useState("");
  const [body,setBody]=useState("");
  const [sender,setSender]=useState("demo@ethereal.email");
  const [startAt,setStartAt]=useState(()=>new Date(Date.now()+60000).toISOString().slice(0,16));
  const [delay,setDelay]=useState(2000);
  const [hourly,setHourly]=useState(200);
  const [recipients,setRecipients]=useState<string[]>([]);
  const [fileName,setFileName]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const [refresh,setRefresh]=useState(0);

  useEffect(()=>{ api.me().then(setUser).catch(()=>setUser(null)); },[]);
  useEffect(()=>{ if(!user)return; setLoading(true); api.emails(tab).then(setEmails).catch(e=>setError(e.message)).finally(()=>setLoading(false)); },[user,tab,refresh]);
  const filtered=useMemo(()=>emails.filter(e=>`${e.recipient} ${e.subject}`.toLowerCase().includes(query.toLowerCase())),[emails,query]);
  async function login(){try{const u=await api.demo();setUser(u);}catch(e:any){setError(e.message);}}
  async function logout(){await api.logout();setUser(null);setEmails([]);}
  function parseFile(file?:File){ if(!file)return; setFileName(file.name); Papa.parse(file,{complete:(result)=>{const values=result.data.flatMap((row:any)=>Array.isArray(row)?row:Object.values(row)).map((v:any)=>String(v||"").trim()); const found=values.filter(v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)); setRecipients([...new Set(found)]); }}); }
  async function schedule(){setError(""); if(!subject.trim()||!body.trim()||!sender.trim()||!recipients.length){setError("Add subject, body, sender and at least one valid recipient.");return;}
    setSubmitting(true);try{const result=await api.schedule({subject,body,senderEmail:sender,startAt:new Date(startAt).toISOString(),delayBetweenMs:Number(delay),hourlyLimit:Number(hourly),recipients});setToast(`${result.count} email(s) scheduled successfully`);setCompose(false);setTab("scheduled");setRefresh(x=>x+1);setSubject("");setBody("");setRecipients([]);setFileName("");}catch(e:any){setError(e.message);}finally{setSubmitting(false);}}
  if(!user)return <div className="loginPage"><div className="loginCard"><div className="brandMark">R</div><h1>Welcome to ReachInbox</h1><p>Schedule and track your outreach emails.</p><button className="googleButton" onClick={()=>window.location.href="http://localhost:4000/auth/google"}>G&nbsp; Continue with Google</button><div className="or"><span>or</span></div><button className="primary full" onClick={login}>Continue with demo account</button><small>Google OAuth requires credentials in backend/.env. Demo mode is for local development.</small></div></div>;
  return <div className="appShell">
    <aside className="sidebar"><div className="logo"><span>R</span> REACHINBOX</div><div className="profile"><div className="avatar">{user.name?.[0]||"U"}</div><div><b>{user.name}</b><small>{user.email}</small></div><span className="chevron">⌄</span></div>
      <button className="composeSide" onClick={()=>setCompose(true)}><Plus size={16}/> Compose</button>
      <div className="navLabel">CORE</div><button className={`navItem ${tab==="scheduled"?"active":""}`} onClick={()=>setTab("scheduled")}><Clock3 size={16}/> Scheduled <span>{tab==="scheduled"?emails.length:""}</span></button><button className={`navItem ${tab==="sent"?"active":""}`} onClick={()=>setTab("sent")}><Send size={16}/> Sent <span>{tab==="sent"?emails.length:""}</span></button>
      <div className="sidebarBottom"><a href="http://localhost:4000/auth/slack">Connect Slack</a><button onClick={logout}><LogOut size={15}/> Logout</button></div>
    </aside>
    <main className="main"><header className="topbar"><div className="mobileBrand">REACHINBOX</div><div className="search"><Search size={16}/><input placeholder="Search emails..." value={query} onChange={e=>setQuery(e.target.value)}/></div><button className="iconButton" title="Filter"><Filter size={17}/></button><button className="iconButton" title="Refresh" onClick={()=>setRefresh(x=>x+1)}><RefreshCw size={17}/></button><div className="userTop"><div className="avatar small">{user.name?.[0]||"U"}</div><span>{user.name}</span><button onClick={logout} title="Logout"><LogOut size={15}/></button></div></header>
      <div className="contentHead"><div><h1>{tab==="scheduled"?"Scheduled Emails":"Sent Emails"}</h1><p>{tab==="scheduled"?"Manage your upcoming email sends":"Review your email sending history"}</p></div><button className="primary" onClick={()=>setCompose(true)}><Plus size={16}/> Compose New Email</button></div>
      {error&&<div className="alert">{error}<button onClick={()=>setError("")}><X size={14}/></button></div>}
      {toast&&<div className="toast">{toast}<button onClick={()=>setToast("")}>×</button></div>}
      <section className="tableCard"><div className="tableTitle"><b>{tab==="scheduled"?"Scheduled queue":"Sent history"}</b><span>{filtered.length} emails</span></div>
        <div className="tableWrap"><table><thead><tr><th>RECIPIENT</th><th>SUBJECT</th><th>{tab==="scheduled"?"SCHEDULED TIME":"SENT TIME"}</th><th>STATUS</th><th></th></tr></thead><tbody>
          {loading?<tr><td colSpan={5} className="empty">Loading emails...</td></tr>:filtered.length===0?<tr><td colSpan={5} className="empty"><div className="emptyIcon"><Mail size={25}/></div><b>No {tab} emails yet</b><p>Your emails will appear here after scheduling.</p></td></tr>:filtered.map(email=><tr key={email.id}><td className="recipient">{email.recipient}</td><td>{email.subject}</td><td>{new Date(tab==="sent"&&email.sentAt?email.sentAt:email.scheduledAt).toLocaleString()}</td><td><span className={`status ${email.status}`}>{email.status}</span></td><td><button className="star"><Star size={16}/></button></td></tr>)}
        </tbody></table></div>
      </section>
      <footer>ReachInbox Scheduler · Demo environment · Queue monitor: <a href="http://localhost:4000/admin/queues" target="_blank">Bull Board</a></footer>
    </main>
    {compose&&<div className="modalBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCompose(false);}}><div className="modal"><div className="modalHeader"><div><h2>Compose New Email</h2><p>Prepare a sequence and schedule your recipients.</p></div><button className="iconButton" onClick={()=>setCompose(false)}><X/></button></div>
      <label>From (sender email)<input value={sender} onChange={e=>setSender(e.target.value)} placeholder="you@example.com"/></label>
      <label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Email subject"/></label>
      <label>Email body<textarea rows={5} value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your email..."/></label>
      <div className="uploadBox"><Upload size={20}/><div><b>Upload CSV or text file</b><small>{fileName?`${fileName} · ${recipients.length} valid email(s) detected`:"Choose a file containing email addresses"}</small></div><label className="fileButton">Browse<input type="file" accept=".csv,.txt,text/plain,text/csv" onChange={e=>parseFile(e.target.files?.[0])}/></label></div>
      <label>Recipients (comma or newline separated)<textarea rows={3} value={recipients.join("\n")} onChange={e=>setRecipients([...new Set(e.target.value.split(/[,\n;\s]+/).map(x=>x.trim()).filter(x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))])} placeholder="person@example.com"/></label>
      <div className="formGrid"><label><span><CalendarClock size={14}/> Start time</span><input type="datetime-local" value={startAt} onChange={e=>setStartAt(e.target.value)}/></label><label>Delay between emails (ms)<input type="number" min="500" value={delay} onChange={e=>setDelay(Number(e.target.value))}/></label><label>Hourly limit<input type="number" min="1" value={hourly} onChange={e=>setHourly(Number(e.target.value))}/></label></div>
      <div className="modalFoot"><span>{recipients.length} recipient(s) ready</span><button className="secondary" onClick={()=>setCompose(false)}>Cancel</button><button className="primary" disabled={submitting} onClick={schedule}>{submitting?"Scheduling...":"Schedule emails"}</button></div>
    </div></div>}
  </div>;
}
