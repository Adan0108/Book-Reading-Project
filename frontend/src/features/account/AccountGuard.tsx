import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import api from '../../lib/axios';
import { message } from '../author/images';

export default function AccountGuard({role}: {role?: string}) {
  const [status,setStatus]=useState('Checking account access…');
  const [allowed,setAllowed]=useState(false);
  useEffect(()=>{
    let active=true;
    api.get('/user/me').then(({data})=>{
      if(!active) return;
      const hasRole=!role || data.metadata.roles?.includes(role);
      setAllowed(hasRole); setStatus(hasRole?'':'This account does not have access to this page.');
    }).catch((error:unknown)=>{if(active)setStatus(message(error));});
    return ()=>{active=false;};
  },[role]);
  if(allowed) return <Outlet/>;
  return <main className="max-w-xl mx-auto p-8"><p role="status">{status}</p><Link className="btn mt-4" to="/login">Sign in</Link></main>;
}
