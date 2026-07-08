import axiosClient from './axiosClient';
import { LoginRequest } from '../models/Login';


export const loginApi = async (data: LoginRequest) => {
  try {
    const response = await axiosClient.post('/api/auth/login', data);
    return response.data;
  } catch (error: any) {
    console.log('Login API Error:', error.response?.data || error.message);
    throw error;
  }
};


export const getUser = async (token: string ) => {
  try{
    const response = await axiosClient.get('/api/auth/me',{
      headers:{
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
    
  }catch(error: any){
    console.log('GetUser Error:', error.response?.data || error.message);
    throw error;
  }

};

export const uploadProfilePic = async (userId: string, token: string, imageUri: string) => {
  try {
    const formData = new FormData();

    // React Native FormData needs this specific object shape for files
    formData.append('photo', {
      uri: imageUri,
      name: 'profile.jpg',
      type: 'image/jpeg',
    } as any);

    const response = await axiosClient.post(
      `/api/users/${userId}/profile-pic`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.log('Upload Profile Pic Error:', error.response?.data || error.message);
    throw error;
  }
};

export const removeProfilePic = async (userId: string, token: string) => {
  try {
    const response = await axiosClient.delete(`/api/users/${userId}/profile-pic`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    console.log('Remove Profile Pic Error:', error.response?.data || error.message);
    throw error;
  }
};