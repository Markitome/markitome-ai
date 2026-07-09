import { Container } from "@cloudflare/containers";

export class MeetingBotContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "8h";
  enableInternet = true;
}
