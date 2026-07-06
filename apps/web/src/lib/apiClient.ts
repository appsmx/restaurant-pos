const API_URL = 'http://localhost:3001/api';

export const apiClient = async (endpoint: string, method: string = 'GET', body: any = null) => {
  const token = localStorage.getItem('pos_token');
  
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(API_URL + endpoint, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Error en la petición');
  }

  return data;
};