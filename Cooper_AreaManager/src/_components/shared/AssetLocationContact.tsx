import { View, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Text } from '@/_components/AppText';
import { MapPin, Phone } from 'lucide-react-native';

type Asset = {
  clientName?: string | null;
  address?: any;
  primaryContactName?: string | null;
  primaryContactNumber?: string | null;
  alternateContactName?: string | null;
  alternateContactNumber?: string | null;
};

type Props = {
  asset: Asset | null | undefined;
  // New Service Job's compact asset card wants just the address, not the
  // phone rows below it — every other caller (task-preview cards) still
  // gets the full location+contact block by default.
  hideContact?: boolean;
  // SR Detail's own card already sits inside its own outer white card, so
  // this one's border reads as a redundant nested outline there — every
  // other caller keeps it (a standalone box on its own white background).
  noBorder?: boolean;
};

// Local numbers arrive bare (no country code) — prepended for display only,
// never touching the raw value the dialer/tel: link actually uses.
function withCountryCode(number: string): string {
  return number.startsWith('+') ? number : `+91 ${number}`;
}

// state/country alone (leftover defaults on an otherwise-empty asset) don't
// count as a real address — only these fields do. An address object that's
// only ever had its state or country filled in still reads as "nothing
// filled in yet" to the person viewing the card.
function hasSpecificAddress(address: any): boolean {
  return !!(address && (address.line1 || address.line2 || address.locality || address.city || address.taluk || address.district || address.pinCode));
}

// This component's own compact address line — just line1/city/district/
// state/pinCode, skipping line2/locality/country that formatAddress (the
// fuller version used on the report screens) includes. Scoped to this
// component rather than changing formatAddress itself, which other screens
// still rely on for the complete address.
function formatAddressShort(address: any): string {
  if (!address) return '';
  return [address.line1, address.city, address.district, address.state, address.pinCode].filter(Boolean).join(', ');
}

// Location + site contact — shared by every task-preview card. All three
// rows always render, even with nothing to show, falling back to an italic
// placeholder rather than collapsing the whole box down to just whichever
// fields happen to be present (matches the reference's AssetLocationContact
// behavior exactly).
export function AssetLocationContact({ asset, hideContact, noBorder }: Props) {
  return (
    <View style={[styles.contactCard, noBorder && styles.contactCardNoBorder]}>
      <View style={styles.locationRow}>
        <MapPin size={22} color="#868686" style={{ marginTop: 2 }} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          {asset?.clientName || hasSpecificAddress(asset?.address) ? (
            <>
              {!!asset?.clientName && <Text style={styles.clientName}>{asset.clientName}</Text>}
              {hasSpecificAddress(asset?.address) && (
                <Text style={styles.address}>{formatAddressShort(asset?.address)}</Text>
              )}
            </>
          ) : (
            <Text style={styles.placeholderText}>Location not available</Text>
          )}
        </View>
      </View>

      {!hideContact && (
        <>
          {/* Site contact — primary number tappable (opens the dialer), alt
              number on its own divided row below, each row justified apart
              (name/label left, number right) rather than wrapped together. */}
          <View style={styles.divider} />
          <View style={styles.contactRow}>
            {asset?.primaryContactName || asset?.primaryContactNumber ? (
              <>
                <View style={styles.contactRowLeft}>
                  <Phone size={18} color="#868686" />
                  {!!asset?.primaryContactName && (
                    <Text style={styles.contactName} numberOfLines={1}>{asset.primaryContactName}</Text>
                  )}
                </View>
                {!!asset?.primaryContactNumber && (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${asset.primaryContactNumber}`)} style={styles.contactRowRight}>
                    <Text style={styles.contactPrimaryNumber} numberOfLines={1}>{withCountryCode(asset.primaryContactNumber)}</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.contactRowLeft}>
                <Phone size={18} color="#868686" />
                <Text style={styles.placeholderText}>Contact not available</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />
          <View style={styles.contactRow}>
            {asset?.alternateContactNumber ? (
              <>
                <View style={styles.contactRowLeft}>
                  <Phone size={18} color="#868686" />
                  {/* The API's alternateContactName names whoever that number
                      actually belongs to — falls back to the generic label
                      only when the backend didn't send one. */}
                  <Text style={styles.altContactLabel} numberOfLines={1}>{asset?.alternateContactName || 'Alternate Contact'}</Text>
                </View>
                <Text style={[styles.contactAltNumber, styles.contactRowRight]} numberOfLines={1}>{withCountryCode(asset.alternateContactNumber)}</Text>
              </>
            ) : (
              <View style={styles.contactRowLeft}>
                <Phone size={18} color="#868686" />
                <Text style={styles.placeholderText}>No alternate contact</Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Outlined box wrapping location + contact rows — a visible border
  // instead of sitting flush/borderless against the rest of the card.
  contactCard: {
    borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },
  contactCardNoBorder: { borderWidth: 0, padding: 0 },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start' },
  clientName: { fontSize: 17, fontWeight: '700', color: '#000000' },
  address: { fontSize: 15, fontWeight: '500', color: '#000000', lineHeight: 20, marginTop: 2 },

  divider: { height: 1, backgroundColor: '#EEEEEE' },
  contactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  // flex: 1 (not just flexShrink) so this side actually claims and shares
  // the row's width instead of sizing to its own content — without it, a
  // long name/label plus a large accessibility font size (seen on a
  // manager's phone with bigger system text) could make this side and the
  // number on the right add up to more than the row's real width, with
  // neither one truncating — they'd just render on top of each other
  // instead of one giving way. numberOfLines={1} on the label Text below is
  // what actually makes it truncate once flex has given it a bounded width.
  contactRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  // The number side never shrinks — it's short and fixed-format (a phone
  // number), so it always reserves its own space and the label above
  // truncates around it instead of the two overlapping.
  contactRowRight: { flexShrink: 0 },
  contactName: { fontSize: 15, fontWeight: '600', color: '#000000', flexShrink: 1 },
  contactPrimaryNumber: { fontSize: 15, fontWeight: '600', color: '#2563EB' },
  altContactLabel: { fontSize: 15, fontWeight: '600', color: '#9CA3AF', flexShrink: 1 },
  contactAltNumber: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
  placeholderText: { fontSize: 15, fontWeight: '500', color: '#9CA3AF', fontStyle: 'italic' },
});
