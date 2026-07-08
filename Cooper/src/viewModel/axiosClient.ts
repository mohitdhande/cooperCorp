import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { API_URL } from '../constants/StringConstants';

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

let isRedirecting = false;

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isLoginRequest = error.config?.url?.includes('/login'); // apna actual login endpoint path check kar lena

    if (error.response?.status === 401 && !isRedirecting && !isLoginRequest) {
      isRedirecting = true;
      console.log('[AUTH] Token expired — clearing session and redirecting to login');
      await AsyncStorage.clear();
      router.replace('/screens/login');
      setTimeout(() => { isRedirecting = false; }, 1000);
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
// import axios from 'axios';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { router } from 'expo-router';
// import { API_URL } from '../constants/StringConstants';

// const axiosClient = axios.create({
//   baseURL: API_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
//   timeout: 10000,
// });

// let isRedirecting = false;

// axiosClient.interceptors.response.use(
//   (response) => response,
//   async (error) => {
//     if (error.response?.status === 401 && !isRedirecting) {
//       isRedirecting = true;
//       console.log('[AUTH] Token expired — clearing session and redirecting to login');
//       await AsyncStorage.clear();
//       router.replace('/screens/login');
//       setTimeout(() => { isRedirecting = false; }, 1000);
//     }
//     return Promise.reject(error);
//   }
// );

// export default axiosClient;