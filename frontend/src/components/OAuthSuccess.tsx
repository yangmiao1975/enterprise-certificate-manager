import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const OAuthSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.location.pathname.startsWith('/oauth-success')) return;
    console.log('OAuthSuccess mounted, location:', window.location.href);
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    console.log('[OAuthSuccess] URLSearchParams:', window.location.search);
    console.log('[OAuthSuccess] Extracted token:', token);
    if (token) {
      localStorage.setItem('authToken', token);
      window.dispatchEvent(new Event('authTokenSet'));
      console.log('[OAuthSuccess] Token set in localStorage. Navigating to /');
      navigate('/', { replace: true });
    } else {
      console.log('[OAuthSuccess] No token found. Navigating to /login');
      navigate('/login');
    }
  }, [navigate]);

  return <div>Signing you in with Google...</div>;
};

export default OAuthSuccess; 