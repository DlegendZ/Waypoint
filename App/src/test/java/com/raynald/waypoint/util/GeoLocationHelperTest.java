package com.raynald.waypoint.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GeoLocationHelperTest {

    @Test
    void haversine_identicalCoordinates_isZero() {
        Double distance = GeoLocationHelper.haversine(-6.2, 106.8, -6.2, 106.8);
        assertThat(distance).isEqualTo(0.0, org.assertj.core.data.Offset.offset(0.0001));
    }

    @Test
    void haversine_oneDegreeLatitudeAtEquator_isApproximately111Km() {
        Double distance = GeoLocationHelper.haversine(0.0, 0.0, 1.0, 0.0);
        assertThat(distance).isCloseTo(111.19, org.assertj.core.data.Offset.offset(0.5));
    }

    @Test
    void haversine_isSymmetric() {
        Double aToB = GeoLocationHelper.haversine(-6.2, 106.8, -6.18, 106.82);
        Double bToA = GeoLocationHelper.haversine(-6.18, 106.82, -6.2, 106.8);
        assertThat(aToB).isCloseTo(bToA, org.assertj.core.data.Offset.offset(0.0001));
    }
}
