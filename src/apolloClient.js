import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const httpLink = createHttpLink({
  uri: `${API_URL}/graphql/`,
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `JWT ${token}` : "",
    }
  }
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
});

// Export for WebSocket usage
export const WS_URL = (import.meta.env.VITE_WS_URL || 'ws://localhost:8000').replace(/\/$/, '');
