// QA-only loopback SMTP sink. Never imported by application source or production builds.
const {SMTPServer}=require('smtp-server');
const http=require('node:http');
exports.startMailbox=async()=>{
  const inbox=new Map();
  const smtp=new SMTPServer({secure:false,disabledCommands:['AUTH','STARTTLS'],logger:false,
    onData(stream,session,done){
      let body='';
      stream.on('data',chunk=>{if(body.length<100000)body+=chunk.toString();});
      stream.on('end',()=>{
        // OTP templates render a single six-digit code. Do not print mail or codes.
        const code=body.match(/>\s*(\d{6})\s*</)?.[1];
        if(code)for(const recipient of session.envelope.rcptTo)inbox.set(recipient.address,{code});
        if(inbox.size>100)inbox.delete(inbox.keys().next().value);
        done();
      });
    }
  });
  const mailbox=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    const result=inbox.get(url.searchParams.get('email'));
    res.writeHead(result?200:404,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(result||{message:'No message received'}));
  });
  await new Promise(resolve=>smtp.listen(2526,'127.0.0.1',resolve));
  await new Promise(resolve=>mailbox.listen(2527,'127.0.0.1',resolve));
};
