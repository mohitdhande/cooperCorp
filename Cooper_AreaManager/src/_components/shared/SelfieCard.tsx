import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
// expo-image (not RN's own Image) — same disk-caching reasoning as
// PhotosVideoCard's own thumbnail.
import { Image } from 'expo-image';
import { Text } from '@/_components/AppText';
import { Camera, RotateCcw, User } from 'lucide-react-native';
import { SitePhoto } from '../../models/taskForm.types';

type Props = {
  photo: SitePhoto | null;
  onCapture: () => void;
};

const MAX_LOAD_RETRIES = 3;

// Mandatory, single, front-camera-only selfie — proof the field person
// filling this step was actually on-site, same intent as this app's
// GPS-gating and OTP verification elsewhere. Deliberately camera-only (no
// gallery pick) and replace-in-place (no separate delete step) — tapping
// the thumbnail again just retakes it. There's no "leave it empty" path:
// Complete Task / Send For Approval hard-block without one (see the
// caller's own completion handler, which is what actually enforces
// "mandatory" — this component only ever shows the current state).
//
// Styled with plain inline objects rather than StyleSheet.create — a
// defensive change from an earlier debugging pass, not the actual fix for
// the real issue below.
//
// The real issue: unlike every other photo in this app, a selfie is
// captured with the front camera (cameraType: front) — on some Android
// devices that capture's file can still be finishing its write to disk
// for a moment after ImagePicker's promise already resolved, so the very
// first attempt to load it here can fail even though the file is genuinely
// fine a moment later. Loading spinner + a few short auto-retries (below)
// covers that race instead of silently showing nothing and leaving it
// looking broken until the screen happens to re-render some other way.
export function SelfieCard({ photo, onCapture }: Props) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Fresh load state whenever the photo itself changes (a new capture, or
  // hydrating a different task) — not on every render.
  useEffect(() => {
    setLoading(true);
    setFailed(false);
    setRetryCount(0);
  }, [photo?.uri]);

  useEffect(() => {
    if (!failed || retryCount >= MAX_LOAD_RETRIES) return;
    const t = setTimeout(() => {
      setFailed(false);
      setLoading(true);
      setRetryCount((c) => c + 1);
    }, 600);
    return () => clearTimeout(t);
  }, [failed, retryCount]);

  const permanentlyFailed = failed && retryCount >= MAX_LOAD_RETRIES;

  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 32, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#FCEEDD', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
          <User size={16} color="#E76124" />
        </View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#000000', letterSpacing: 0.4, flex: 1 }}>SELFIE</Text>
        <View style={{ borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#FEE2E2' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>Required</Text>
        </View>
      </View>

      {photo ? (
        // Plain View, not TouchableOpacity, wrapping the image — matching
        // every other working thumbnail in this app (PhotosVideoCard,
        // taskReport.tsx's own Selfie section). Wrapping the whole
        // image+overlays in one TouchableOpacity (an Animated.View
        // internally) combined with overflow:hidden and several absolutely
        // positioned children turned out to be why nothing inside it was
        // showing up reliably — the retake tap target is now its own
        // separate absolutely-positioned overlay instead.
        <View style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16, overflow: 'hidden', marginTop: 16, backgroundColor: '#F3F4F6' }}>
          {/* key forces a real remount on retry — expo-image otherwise
              treats an unchanged uri as "already tried, already failed"
              and won't attempt the fetch again on its own. */}
          <Image
            key={`${photo.uri}-${retryCount}`}
            source={{ uri: photo.uri }}
            style={{ width: '100%', height: '100%' }}
            onLoadStart={() => setLoading(true)}
            onLoad={() => { setLoading(false); setFailed(false); }}
            onError={() => { setLoading(false); setFailed(true); }}
          />

          {loading && !permanentlyFailed && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(243,244,246,0.85)' }}>
              <ActivityIndicator color="#E76124" />
            </View>
          )}

          {permanentlyFailed && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', gap: 4, paddingHorizontal: 16 }}>
              <Camera size={22} color="#9CA3AF" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', textAlign: 'center' }}>Couldn't load the preview — tap to retake</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={onCapture}
            activeOpacity={0.85}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 8 }}
          >
            <RotateCcw size={14} color="#FFFFFF" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF', marginLeft: 6 }}>Retake</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={onCapture}
          style={{ borderWidth: 1, borderColor: '#C6C6C6', borderStyle: 'dashed', borderRadius: 24, backgroundColor: '#F8F8F8', paddingVertical: 24, alignItems: 'center', marginTop: 16 }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
            <Camera size={22} color="#6B7280" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#000000' }}>Take Selfie</Text>
          <Text style={{ fontSize: 14, fontWeight: '400', color: '#9CA3AF', marginTop: 2 }}>Tap to open front camera</Text>
        </TouchableOpacity>
      )}

      {/* Display-only caption, not sent to the backend — the media confirm
          API has no note/caption field (just gcsUrl/type/tags/location). */}
      <Text style={{ fontSize: 12, fontWeight: '500', color: '#9CA3AF', lineHeight: 17, marginTop: 12 }}>Note: Selfie with Genset</Text>
    </View>
  );
}
