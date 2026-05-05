import React, { useState } from 'react';
import { gql, useMutation } from '@apollo/client';
import { useNavigate, Link } from 'react-router-dom';

const SIGN_IN_MUTATION = gql`
  mutation TokenAuth($username: String!, $password: String!) {
    tokenAuth(username: $username, password: $password) {
      token
      payload
    }
  }
`;

export default function SignIn() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  
  const [signIn, { loading, error }] = useMutation(SIGN_IN_MUTATION, {
    onCompleted: (data) => {
      localStorage.setItem('token', data.tokenAuth.token);
      localStorage.setItem('username', username);
      window.location.href = '/chat';
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    signIn({ variables: { username, password } });
  };

  return (
    <div className="app-container">
      <div className="auth-card">
        <h1>Welcome Back</h1>
        <p>Sign in to continue to ChatApp</p>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              required 
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          
          {error && <p style={{color: 'var(--error)', marginBottom: '1rem', fontSize: '0.875rem'}}>{error.message}</p>}
          
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <div className="auth-links">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
