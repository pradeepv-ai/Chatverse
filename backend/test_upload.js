const fs = require('fs');
const https = require('https');
const FormData = require('form-data');

fs.writeFileSync('test.png', 'fake image data');

const form = new FormData();
form.append('image', fs.createReadStream('test.png'));

const req = https.request('https://chatverse-backend-5x7w.onrender.com/upload', {
  method: 'POST',
  headers: form.getHeaders()
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', body));
});

req.on('error', console.error);
form.pipe(req);
