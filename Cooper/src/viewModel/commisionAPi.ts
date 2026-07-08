import axiosClient from './axiosClient';

export const getMyCommissioningTasks = async (token: string) => {   //gives all tasks
  try {
    const response = await axiosClient.get(
      '/api/commissioning?myTask=true',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.log(
      'Commissioning API Error:',
      error.response?.data || error.message
    );
    throw error;
  }
};

export const getAssets = async (token: string) => {  //give all cards
  try {
    const response = await axiosClient.get('/api/assets', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log("from api---------------",response.data);
    return response.data;
  } catch (error: any) {
    console.log('Get Assets Error:', error.response?.data || error.message);
    throw error;
  }
};


export const getMyTasksByStatus = async (token: string, status: string) => {
  try {
    const response = await axiosClient.get(`/api/me/tasks?status=${status}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get My Tasks Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getCommissioningTaskDetail = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.get(`/api/commissioning/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Task Detail Error:', error.response?.data || error.message);
    throw error;
  }
};


export const acceptCommissioningTask = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/accept`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Accept Task Error:', error.response?.data || error.message);
    throw error;
  }
};

export const startCommissioningTask = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/start`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Start Task Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getAssetById = async (token: string, assetId: string) => {
  try {
    const response = await axiosClient.get(`/api/assets/${assetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Asset Error:', error.response?.data || error.message);
    throw error;
  }
};

export const updateAsset = async (token: string, assetId: string, body: Record<string, any>) => {
  try {
    const response = await axiosClient.put(`/api/assets/${assetId}`, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Update Asset Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getCommissioningProgress = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.get(`/api/commissioning/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Progress Error:', error.response?.data || error.message);
    throw error;
  }
};

export const saveCommissioningProgress = async (
  token: string,
  taskId: string,
  commissioningChecks: Record<string, string>
) => {
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/progress`,
      { commissioningChecks },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Save Progress Error:', error.response?.data || error.message);
    throw error;
  }
};

export const saveCommissioningReadings = async (
  token: string,
  taskId: string,
  readings: Record<string, any>
) => {
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/readings`,
      { readings },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Save Readings Error:', error.response?.data || error.message);
    throw error;
  }
};

export const generateCommissioningOtp = async (token: string, taskId: string) => {
  const response = await axiosClient.post(
    `/api/commissioning/${taskId}/otp/generate`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data; // { code: "1234" }
};

export const verifyCommissioningOtp = async (token: string, taskId: string, code: string) => {
  console.log('[API] verifyCommissioningOtp -> POST', `/api/commissioning/${taskId}/otp/verify`, 'body:', { code });
  try {
    const response = await axiosClient.post(
      `/api/commissioning/${taskId}/otp/verify`,
      { code },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('[API] verifyCommissioningOtp response.data:', JSON.stringify(response.data));
    return response.data; // { verified: true }
  } catch (error: any) {
    console.log('[API] verifyCommissioningOtp FAILED:', error.response?.status, JSON.stringify(error.response?.data) || error.message);
    throw error;
  }
};

export const completeCommissioningTask = async (
  token: string,
  taskId: string,
  body: Record<string, any> = {}
) => {
  console.log('[API] completeCommissioningTask -> PUT', `/api/commissioning/${taskId}/complete`, 'body:', JSON.stringify(body));
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/complete`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('[API] completeCommissioningTask response.data:', JSON.stringify(response.data));
    return response.data;
  } catch (error: any) {
    console.log('[API] completeCommissioningTask FAILED:', error.response?.status, JSON.stringify(error.response?.data) || error.message);
    throw error;
  }
};

export const uploadCommissioningPhotos = async (
  token: string,
  taskId: string,
  photos: { uri: string; fileName: string }[]
) => {
  const formData = new FormData();

  photos.forEach((photo, index) => {
    const fileName = photo.fileName || `photo_${index}.jpg`;
    const extMatch = fileName.match(/\.(\w+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
    const mimeType =
      ext === 'png' ? 'image/png' :
      ext === 'webp' ? 'image/webp' :
      'image/jpeg';

    // React Native FormData expects this exact shape (uri/name/type)
    formData.append('photos', {
      uri: photo.uri,
      name: fileName,
      type: mimeType,
    } as any);
  });

  console.log('[API] uploadCommissioningPhotos -> POST', `/api/commissioning/${taskId}/photos`, 'photo count:', photos.length);
  try {
    const response = await axiosClient.post(
      `/api/commissioning/${taskId}/photos`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    console.log('[API] uploadCommissioningPhotos — status code:', response.status);
    console.log('[API] uploadCommissioningPhotos response.data:', JSON.stringify(response.data));
    if (response.status === 200) {
      console.log('[API] ✅ Status 200 — photos uploaded successfully on server');
    }
    return response.data; // { photos: ["https://storage..."] }
  } catch (error: any) {
    console.log('[API] uploadCommissioningPhotos FAILED:', error.response?.status, JSON.stringify(error.response?.data) || error.message);
    throw error;
  }
};


export const saveValidationProgress = async (
  token: string,
  taskId: string,
  validationChecks: Record<string, string>
) => {
  console.log('[API] saveValidationProgress -> PUT', `/api/commissioning/${taskId}/progress`, 'body:', JSON.stringify({ validationChecks }));
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/progress`,
      { validationChecks },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('[API] saveValidationProgress response.data:', JSON.stringify(response.data));
    return response.data;
  } catch (error: any) {
    console.log('[API] saveValidationProgress FAILED:', error.response?.status, JSON.stringify(error.response?.data) || error.message);
    throw error;
  }
};

export const getFaultCodes = async (token: string) => {
  const response = await axiosClient.get('/api/fault-codes',  {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  return response.data;
};

export const getParts = async (token: string) => {
  const response = await axiosClient.get('/api/parts',  {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  return response.data;
};

export const saveStepProgress = async (token: string, taskId: string, body: object) => {
  const response = await axiosClient.put(
    `/api/commissioning/${taskId}/save-progress`,
    body,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};