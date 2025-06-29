// Add this to your browser console to debug the upload
// Open DevTools -> Console and paste this:

console.log('🔍 Debug Certificate Upload');

// Check authentication token
const token = localStorage.getItem('authToken');
console.log('🔑 Auth Token:', token ? 'Present (' + token.length + ' chars)' : 'Missing');

if (token) {
  try {
    // Decode JWT payload (note: this doesn't verify signature)
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('📋 Token payload:', payload);
    console.log('📅 Token expires:', new Date(payload.exp * 1000));
    console.log('⏰ Token expired?', Date.now() > payload.exp * 1000);
  } catch (e) {
    console.log('❌ Invalid token format');
  }
}

// Check API base URL
console.log('🌐 API Base URL:', window.location.origin);

// Test API connectivity
fetch('/api/health', {
  headers: {
    'Authorization': token ? `Bearer ${token}` : undefined
  }
}).then(res => {
  console.log('🏥 Health check:', res.status, res.statusText);
  return res.json();
}).then(data => {
  console.log('📊 Health data:', data);
}).catch(err => {
  console.log('❌ Health check failed:', err);
});