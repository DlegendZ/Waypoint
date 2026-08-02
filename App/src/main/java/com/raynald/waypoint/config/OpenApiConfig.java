package com.raynald.waypoint.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeIn;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;

@OpenAPIDefinition(
        info = @Info(
                title = "Waypoint API",
                version = "v1",
                description = "Real-time fleet and delivery tracking backend. REST endpoints are documented "
                        + "here; live location updates are pushed over a separate STOMP/WebSocket channel "
                        + "(see README) authenticated with the same cookie.")
)
@SecurityScheme(
        name = "cookieAuth",
        type = SecuritySchemeType.APIKEY,
        in = SecuritySchemeIn.COOKIE,
        paramName = "token")
public class OpenApiConfig {
}
