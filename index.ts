import dotenv from "dotenv";
import fs from "fs";
import { REST } from "@discordjs/rest";
import {
  Client,
  SlashCommandBuilder,
  PermissionFlagsBits,
  Routes,
  ActivityType,
  ChatInputCommandInteraction,
} from "discord.js";
import config from "./config";
import Time from "./time";

dotenv.config();

const client = new Client({
  intents: ["Guilds"],
});

client.login(process.env.TOKEN);

client.on("ready", () => {
  console.log(`Logged in as ${client.user?.tag}`);

  const commands = [
    new SlashCommandBuilder().setName("water").setDescription("Water the plant"),
    new SlashCommandBuilder()
      .setName("reset")
      .setDescription("Reset the plant")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ].map((command) => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(client.token as string);
  rest
    .put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands })
    .then(() => console.log("Successfully registered application commands."))
    .catch(console.error);

  setInterval(tick, new Time("1h").ms());
  tick();
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const commandName = interaction.commandName;

  switch (commandName) {
    case "water":
      await water(interaction);
      break;
    case "reset":
      await reset(interaction);
      break;
  }
});

async function tick() {
  const data = loadData();
  data.waterLevel -= randomInt(5, 10);

  if (data.waterLevel < 0) {
    data.waterLevel = 0;

    data.life -= randomInt(1, 3);

    // underwatered
    if (new Time(data.lastFed).d() > 1) {
      data.life -= randomInt(5, 7);
    }
  } else if (data.waterLevel > 75 && data.waterLevel < 100) {
    data.life += 1;
    if (data.life > 100) {
      data.life = 100;
    }
  } else if (data.waterLevel > 100) {
    // overwatered
    data.life -= randomInt(1, 3);
  } else if (data.waterLevel > 150) {
    // super overwatered
    data.life -= Math.floor(data.waterLevel / 10);
  }

  if (data.life < 0) {
    data.life = 0;
  }

  saveData(data);
  await setStatus();
}

async function water(interaction: ChatInputCommandInteraction) {
  const data = loadData();
  data.waterLevel += randomInt(10, 30);
  data.lastFed = Date.now();

  
  saveData(data);
  await setStatus();

  interaction.reply("💧");
}

async function reset(interaction: ChatInputCommandInteraction) {
  const data = loadData();
  data.life = 100;
  data.lastFed = Date.now();
  data.waterLevel = 50;
  saveData(data);

  interaction.reply("✅");
}

async function setStatus() {
  const data = loadData();
  if (data.life > 0) {
    await setPfp(true);
    client.user?.setActivity({
      type: ActivityType.Playing,
      name: `plant games | ${data.life}% life | ${data.waterLevel}% water`,
    });
  } else {
    await setPfp(false);
    client.user?.setActivity({
      type: ActivityType.Playing,
      name: `dead`,
    });
  }
}

async function setPfp(alive: boolean) {
  if (alive) {
    client.user
      ?.setAvatar("https://cdn.discordapp.com/attachments/882015231126163507/1008977396763996251/unknown.png")
      .catch(() => {});
  } else {
    client.user
      ?.setAvatar("https://cdn.discordapp.com/attachments/882015231126163507/1008977534907580476/unknown.png")
      .catch(() => {});
  }
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function loadData() {
  const data = JSON.parse(fs.readFileSync("./data.json", "utf8")) as {
    life: number;
    lastFed: number;
    waterLevel: number;
  };

  return data;
}

function saveData(data: { life: number; lastFed: number; waterLevel: number }) {
  fs.writeFileSync("./data.json", JSON.stringify(data));
}
