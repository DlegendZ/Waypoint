package com.raynald.waypoint.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class TestController {

    @MessageMapping("/location/test")
    @SendTo("/topic/order/test")
    public String handleTest(String message) {
        return "Echo: " + message;
    }
}
