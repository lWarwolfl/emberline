import * as Party from "./party";
import Economy from "./economy";
import Content from "./content";
import Engine from "./engine";
import Upgrades from "./upgrades";
import App from "./app";
import UI from "./ui";
import Sprites from "./sprites";
import Audio from "./audio";
import Wardrobe from "./wardrobe";
import UpgradePanel from "./upgrade-panel";
import Renderer from "./renderer";
import Generator from "./generator";
import Combat from "./combat";
import Random from "./random";
import Storage from "./storage";
import Input from "./input";
import Particles from "./particles";
import Difficulty from "./difficulty";
import Loadout from "./loadout";
import Popups from "./popups";
import Backgrounds from "./backgrounds";
import Cloth from "./cloth";
import Pixel from "./pixel";
import Config from "./config";
import Traversal from "./traversal";
import EnemyFire from "./enemy-fire";
import Powerups from "./powerups";
import "./pwa";
const Emberline = {
  Party,
  Powerups,
  Traversal,
  EnemyFire,
  Economy,
  Content,
  Engine,
  Upgrades,
  App,
  UI,
  Sprites,
  Audio,
  Wardrobe,
  UpgradePanel,
  Renderer,
  Generator,
  Combat,
  Random,
  Storage,
  Input,
  Particles,
  Difficulty,
  Loadout,
  Popups,
  Backgrounds,
  Cloth,
  Pixel,
  Config,
};
declare global {
  interface Window {
    Emberline: typeof Emberline;
    EmberlineDebug?: {
      app: ReturnType<typeof App.create>;
      engine: typeof Engine;
      generator: typeof Generator;
    };
    webkitAudioContext?: typeof AudioContext;
  }
}
window.Emberline = Emberline;
/* Browser entry point; bundled for offline file:// launches. */
(() => {
  "use strict";
  const app = Emberline.App.create(document);
  // Explicit developer mode enables inspection without adding controls to the game.
  if (new URLSearchParams(location.search).has("dev")) {
    window.EmberlineDebug = { app, engine: Emberline.Engine, generator: Emberline.Generator };
  }
})();
