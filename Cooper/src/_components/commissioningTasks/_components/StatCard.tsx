import React from 'react';
import { View, Text, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const StatCard = ({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) => {
  return (
    <View
      style={{
        backgroundColor: color,
        width: width * 0.22,
        height: 100,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: '#fff',
          fontSize: 24,
          fontWeight: '700',
        }}
      >
        {value}
      </Text>

      <Text
        style={{
          color: '#fff',
          marginTop: 4,
        }}
      >
        {title}
      </Text>
    </View>
  );
};
