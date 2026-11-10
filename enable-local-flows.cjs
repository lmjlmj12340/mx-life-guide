const fs=require('fs'),path=require('path');
function walk(dir) {
  for (const item of fs.readdirSync(dir,{withFileTypes:true})) {
    const file=path.join(dir,item.name);
    if(item.isDirectory()) walk(file);
    else if(item.name==='index.html') {
      let html=fs.readFileSync(file,'utf8');
      html=html.replace(/<a\b[^>]*href="\/sign-in(?:[?#][^"]*)?"[^>]*>[\s\S]*?<\/a>/gi,'')
        .replace(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?登录同步(?:(?!<\/button>)[\s\S])*?<\/button>/gi,'');
      if(!html.includes('src="/flows.js"')) html=html.replace('</body>','<script src="/flows.js"></script></body>');
      fs.writeFileSync(file,html);
    }
  }
}
walk('site');
