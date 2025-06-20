const path = require("path");
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const readline = require("readline");
const pino = require("pino");
const { handleCommands } = require("./core/handleCommands.js");
const { participantsUpdate } = require("./core/participantsUpdate.js");
const config = require("./config/config.js"); // Prefixo e dono puxado daqui

const question = (string) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(string, (ans) => {
    rl.close();
    resolve(ans);
  }));
};

const connect = async () => {
  const { state, saveCreds } = await useMultiFileAuthState(
    path.resolve(__dirname, ".", "assets", "auth", "creds")
  );

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    printQRInTerminal: false,
    version,
    logger: pino({ level: "silent" }),
    auth: state,
    browser: ["Bot WA", "Chrome", "1.0.0"],
    markOnlineOnConnect: true,
  });

  if (!sock.authState.creds.registered) {
    let phoneNumber = await question("📱 Informe o seu número de telefone (somente números): ");
    phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

    if (!phoneNumber) {
      throw new Error("❌ Número de telefone inválido!");
    }

    const code = await sock.requestPairingCode(phoneNumber);
    console.log("🔑 Código de pareamento:", code);
  }

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log("⚠️ Conexão fechada. Tentando reconectar...", shouldReconnect);

      if (shouldReconnect) {
        connect(); // reconexão automática
      }
    } else if (connection === "open") {
      console.log("✅ Bot conectado com sucesso!");
      console.log(`👑 Dono: ${config.dono}`);
      console.log(`🤖 Bot: ${config.bot}`);
      console.log(`📍 Prefixo: ${config.prefixo}`);
      console.log(`📦 Versão: ${config.versao}`);
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // Inicia comandos e eventos
  handleCommands(sock);
  participantsUpdate(sock);
};

connect(); // 🔁 chama a função principal diretamente
