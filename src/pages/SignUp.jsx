import React, { useState } from 'react';
import { gql, useMutation } from '@apollo/client';
import { useNavigate, Link } from 'react-router-dom';

const SIGN_UP_MUTATION = gql`
  mutation CreateUser($username: String!, $email: String!, $password: String!) {
    createUser(username: $username, email: $email, password: $password) {
      token
      user {
        id
        username
      }
    }
  }
`;

export default function SignUp() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  
  const [signUp, { loading, error }] = useMutation(SIGN_UP_MUTATION, {
    onCompleted: (data) => {
      localStorage.setItem('token', data.createUser.token);
      localStorage.setItem('username', data.createUser.user.username);
      window.location.href = '/chat';
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    signUp({ variables: { username, email, password } });
  };

  return (
    <div className="app-container">
      <div className="auth-card">
        <h1>Create Account</h1>
        <p>Join ChatApp and start messaging</p>
        
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
            <label>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
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
            {loading ? 'Creating...' : 'Sign Up'}
          </button>
        </form>
        
        <div className="auth-links">
          Already have an account? <Link to="/signin">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
