package com.raynald.waypoint.util;

public class GeoLocationHelper {

    public static Double haversine(
            Double lat1, Double lng1,
            Double lat2, Double lng2
    ) {
        Double lat1Rad = Math.toRadians(lat1);
        Double lng1Rad = Math.toRadians(lng1);
        Double lat2Rad = Math.toRadians(lat2);
        Double lng2Rad = Math.toRadians(lng2);

        Double latRadDiff = lat2Rad - lat1Rad;
        Double lngRadDiff = lng2Rad - lng1Rad;

        Double a = Math.pow(Math.sin(latRadDiff/2),2) + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.pow(Math.sin(lngRadDiff/2),2);

        Double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return 6371 * c;
    }
}
