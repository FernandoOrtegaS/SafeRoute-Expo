import { StyleSheet, View } from 'react-native';


import React from 'react';
import MapView, { Circle, Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';

export default function HomeScreen() {
  const origin = {latitude: -33.440058, longitude: -70.640881};
  const destination = {latitude: -33.436872, longitude: -70.638914};
  const GOOGLE_MAPS_APIKEY = 'AIzaSyBdLccbhV2MPNVXgs4PEISQCmE8LY9A7e0';

  const lats = [];
  const lngs = [];

  return (
    <View style={styles.container}>
      <MapView style={styles.map}
        provider="google"
        region={{
          latitude: -33.438367,
          longitude: -70.640500,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
        zoomEnabled={true}
        rotateEnabled={false}
        scrollEnabled={true}
        pitchEnabled={false}
      >
        <Circle
          center={destination}
          radius={10}
          strokeColor='blue'
          fillColor='blue'
        />
        <Circle
          center={origin}
          radius={10}
          strokeColor='blue'
          fillColor='blue'
        />
        <Marker
          coordinate={destination}
        />
        <MapViewDirections
          origin={origin}
          destination={destination}
          apikey={GOOGLE_MAPS_APIKEY}
          mode='WALKING'
          strokeWidth={10}
        />
        
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  }
});
