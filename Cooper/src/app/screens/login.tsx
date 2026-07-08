import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator, Image,
  KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLoginController } from '../../controllers/authController';

const { width } = Dimensions.get('window');

// Renders the login experience and delegates the auth workflow to the controller hook.
export default function LoginScreen() {
  const {
    username,
    setUsername,
    password,
    setPassword,
    loading,
    loginError,
    showPassword,
    togglePasswordVisibility,
    handleLogin,
  } = useLoginController();

  return (
  <SafeAreaView style={styles.container}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, width: '100%' }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.card}>

          {/* Brand header */}
          <View style={styles.brandHeader}>
            <Image source={require('@/assets/logo_circular.png')} style={styles.brandLogo} />
            <Text style={styles.brandSubtitle}>Gentset E-FSR</Text>
          </View>

          <Text style={styles.fieldLabel}>EMAIL OR MOBILE</Text>
          <TextInput
            placeholder="Email address or mobile number"
            placeholderTextColor="#aaa"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            returnKeyType="next"
          />

          <Text style={styles.fieldLabel}>PASSWORD</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              placeholder="Enter your password"
              placeholderTextColor="#aaa"
              secureTextEntry={!showPassword}
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={togglePasswordVisibility}
            >
              <Ionicons
                name={showPassword ? 'eye' : 'eye-off'}
                size={20}
                color="#aaa"
              />
            </TouchableOpacity>
          </View>

          {/* Error message */}
          {loginError ? (
  <Text style={styles.loginErrorText}>{loginError}</Text>
) : null}

          <TouchableOpacity style={styles.forgotPasswordContainer}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.buttonText}>Login</Text>
            }
          </TouchableOpacity>

          {/* Extra padding so button stays visible above keyboard */}
          <View style={{ height: 40 }} />

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
);
  
}

const CARD_WIDTH = Math.min(width * 0.9, 400);

const styles = StyleSheet.create({
  loginErrorText: {
  color: '#F26722',       // ← changed from '#FCA5A5' to orange
  fontSize: 13,
  textAlign: 'center',
  marginBottom: 10,
  fontWeight: '600',
},
  scrollContent: {
  flexGrow: 1,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 40,    // ← increased from 30
},
card: {
  width: CARD_WIDTH,
  backgroundColor: '#241D67',
  borderRadius: 24,
  padding: 24,
  paddingBottom: 16,      // ← tighter bottom padding, the height:40 View handles spacing
},
  container: {
    flex: 1,
    backgroundColor: '#241D67',
  },


  brandHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandLogo: { width: 72, height: 72, marginBottom: 12 },
  brandSubtitle: {
    fontSize: 16, color: '#F26722', fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: '#FFFFFF',
    letterSpacing: 0.3, marginBottom: 8,
  },
  input: {
    height: 55, borderWidth: 1, borderColor: '#DADADA',
    borderRadius: 14, paddingHorizontal: 16, fontSize: 16,
    marginBottom: 18, backgroundColor: '#FFF',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1, borderColor: '#DADADA',
    borderRadius: 14, backgroundColor: '#FFF',
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1, height: 55,
    paddingHorizontal: 16, fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 14, height: 55,
    justifyContent: 'center', alignItems: 'center',
  },
 
  forgotPasswordContainer: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotPasswordText: { color: '#F26722', fontSize: 14, fontWeight: '600' },
  button: {
    height: 55, borderRadius: 14, backgroundColor: '#F26722',
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
});

// import React, { useState } from 'react';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useRouter } from 'expo-router';

// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   StyleSheet,
//   Dimensions,
//   ActivityIndicator,
//   Image,
// } from 'react-native';

// import { SafeAreaView } from 'react-native-safe-area-context';

// import { getUser, loginApi } from '../../viewModel/LoginAPis';

// import { LoginRequest, UserProfile } from '../../models/Login';

// const { width } = Dimensions.get('window');

// export default function LoginScreen() {
//    const router = useRouter();
//     const [username, setusername] = useState('');
// const [password, setPassword] = useState('');
// const [loading, setLoading] = useState(false);
// const [loginError, setLoginError] = useState('');

// const handleLogin = async () => {
//   setLoading(true);
//    setLoginError('');
//   try {
//    const request: LoginRequest = { username, password };
    
//     // 1. First API call: Authenticate and get a token
//     const loginResponse = await loginApi(request); 
//     console.log(loginResponse);
//     const token = loginResponse.token;
//     console.log(token);

//     // 2. Second API call: Use that token to fetch details
//     const profileResponse: UserProfile = await getUser(token); // 👈 Called here!
// console.log(profileResponse);
//     // 3. Save both keys to memory
//     await AsyncStorage.setItem('token', token);
//     profileResponse.profilePic = loginResponse.profilePic;//'https://static.vecteezy.com/system/resources/thumbnails/048/216/761/small/modern-male-avatar-with-black-hair-and-hoodie-illustration-free-png.png';
//     console.log('++++++profile url',profileResponse.profilePic);
//     await AsyncStorage.setItem('userData', JSON.stringify(profileResponse));

//     // 4. Navigate forward
//   if (profileResponse.role === 'admin') {
//   router.replace('/screens/home');
// } else if (profileResponse.role === 'engineer') {
//   router.replace('/screens/commissioningTasks');
// } else {
//   // fallback for any other/unexpected role
//   router.replace('/screens/home');
// }
//   } catch (error: any) {
//     console.log('Login Failed:', error);
//     setLoginError(
//       error.response?.data?.message ||
//       (error.message === 'Network Error'
//         ? 'No internet connection. Please check your network.'
//         : 'Invalid username or password. Please try again.')
//     );
//     setLoading(false);
//   }
// };

// const forgotPassword =()=>{
//   console.log('hii')
// }



//   return (
//     <SafeAreaView style={styles.container}>
//      <View style={styles.card}>
//         <View style={styles.brandHeader}>
//           <Image source={require('@/assets/logo_circular.png')} style={styles.brandLogo} />
//           <Text style={styles.brandTitle}>Cooper Corp</Text>
//           <Text style={styles.brandSubtitle}>Gentset E-FSR</Text>
//         </View>

//         <Text style={styles.fieldLabel}>EMAIL OR MOBILE</Text>
//         <TextInput
//           placeholder="Email address or mobile number"
//           placeholderTextColor="#888"
//           style={styles.input}
//           keyboardType="email-address"
//           value={username}
//   onChangeText={setusername}
//         />
//  <Text style={styles.fieldLabel}>PASSWORD</Text>
//         <TextInput
//           placeholder="Enter your password"
//           placeholderTextColor="#888"
//           secureTextEntry
//           style={styles.input}
//            value={password}
//            onChangeText={setPassword}
//         />

// {loginError ? (
//           <Text style={styles.loginErrorText}>{loginError}</Text>
//         ) : null}

//         <TouchableOpacity 
//   style={styles.forgotPasswordContainer} 
//   onPress={forgotPassword}
// >
//   <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
// </TouchableOpacity>

//        <TouchableOpacity
//   style={[styles.button, loading && styles.buttonDisabled]}
//   onPress={handleLogin}
//   disabled={loading}
// >
//   {loading ? (
//     <ActivityIndicator color="#fff" size="small" />
//   ) : (
//     <Text style={styles.buttonText}>Login</Text>
//   )}
// </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// }

// const CARD_WIDTH = Math.min(width * 0.9, 400);

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#241D67',
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingHorizontal: 20,
//   },
//   card: {
//     width: CARD_WIDTH,
//     backgroundColor: '#241D67',
//     borderRadius: 24,
//     padding: 24,
//   },
//  loginErrorText: {
//     color: '#DC2626',
//     fontSize: 14,
//     textAlign: 'center',
//     marginBottom: 14,
//     fontWeight: '500',
//   },
//   forgotPasswordContainer: {
//   alignSelf: 'flex-end',
//   marginBottom: 20,
// },
// forgotPasswordText: {
//   color: '#F26722',
//   fontSize: 14,
//   fontWeight: '600',
// },
// brandHeader: {
//     alignItems: 'center',
//     marginBottom: 28,
//   },
//   brandLogo: {
//     width: 64,
//     height: 64,
//     marginBottom: 10,
//   },
// brandTitle: {
//     fontSize: 22,
//     fontWeight: '700',
//     color: '#FFFFFF',
//   },
//   brandSubtitle: {
//     fontSize: 13,
//     color: '#F26722',
//     fontWeight: '600',
//     marginTop: 2,
//   },
// fieldLabel: {
//     fontSize: 12,
//     fontWeight: '700',
//     color: '#FFFFFF',
//     letterSpacing: 0.3,
//     marginBottom: 8,
//   },
//   input: {
//     height: 55,
//     borderWidth: 1,
//     borderColor: '#DADADA',
//     borderRadius: 14,
//     paddingHorizontal: 16,
//     fontSize: 16,
//     marginBottom: 18,
//     backgroundColor: '#FFF',
//   },
// button: {
//     height: 55,
//     borderRadius: 14,
//     backgroundColor: '#F26722',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginTop: 8,
//   },
//   buttonText: {
//     color: '#FFF',
//     fontSize: 18,
//     fontWeight: '600',
//   },
//   buttonDisabled: {
//   opacity: 0.7,
// },
// });