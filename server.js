// Optional Node.js backend scaffold for Stripe Checkout
// Usage: set STRIPE_SECRET_KEY in env and run `node server.js`
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve static files (so images under /assets/photos are accessible)
app.use(express.static(path.join(__dirname)));

const stripeKey = process.env.STRIPE_SECRET_KEY;
if(!stripeKey){
  console.warn('Warning: STRIPE_SECRET_KEY not set — server will run but checkout will not work.');
}

let stripe = null;
if(stripeKey){
  stripe = require('stripe')(stripeKey);
}

app.post('/create-checkout-session', async (req, res) => {
  if(!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  const { items, customer } = req.body;
  try{
    const line_items = (items||[]).map(i=>({ price_data: { currency: 'usd', product_data: { name: i.name }, unit_amount: i.price_cents }, quantity: i.qty }));
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      success_url: (req.headers.origin || 'http://localhost:3000') + '/?success=1',
      cancel_url: (req.headers.origin || 'http://localhost:3000') + '/?canceled=1',
      metadata: { customer_name: customer?.name || '', customer_email: customer?.email || '' }
    });
    res.json({ url: session.url });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: err.message || 'stripe error' });
  }
});

// Return a list of photo filenames from assets/photos
app.get('/photos', (req, res) => {
  const photosDir = path.join(__dirname, 'assets', 'photos');
  fs.readdir(photosDir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Unable to read photos directory' });
    const images = (files || []).filter(f => /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(f));
    res.json(images);
  });
});

const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log('Server running on port', port));
