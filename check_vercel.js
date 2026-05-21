const https = require('https');
https.get('https://chatverse-amber.vercel.app/', (res) => {
  let html = '';
  res.on('data', d => html += d);
  res.on('end', () => {
    const match = html.match(/src="\/assets\/(index-[^"]+\.js)"/);
    if (match) {
      https.get('https://chatverse-amber.vercel.app/assets/' + match[1], (res2) => {
        let js = '';
        res2.on('data', d => js += d);
        res2.on('end', () => {
          console.log('BEAUTIFUL:', js.includes('beautiful name'));
          console.log('MD HIDDEN:', js.includes('md:hidden'));
        });
      });
    } else {
      console.log('JS NOT FOUND');
    }
  });
});
