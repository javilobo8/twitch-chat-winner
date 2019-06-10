/* eslint-disable no-console */
const WebSocket = require('ws');
const axios = require('axios').default;
const _ = require('lodash');
const Handlebars = require('handlebars');

const DEFAULT_WINNER_MESSAGE = `/me ————————————————————————— imGlitch Enhorabuena {{ winner }} has ganado! Escribe en el chat para recibir el premio! —————————————————————————`;

const CHANNEL = process.env.TCW_CHANNEL || '#javilobo8';
const NICK = process.env.TCW_NICK || 'javilobo8';
const PASS = process.env.TCW_PASS;
const WINNER_TIMEOUT = process.env.TCW_WINNER_TIMEOUT ? parseInt(process.env.TCW_WINNER_TIMEOUT) : 60;
const WINNER_MESSAGE = process.env.TCW_WINNER_MESSAGE || DEFAULT_WINNER_MESSAGE;
const WINNER_MESSAGE_ANSWER = process.env.TCW_WINNER_MESSAGE_ANSWER || '/me TOMAAAAAAAAAAAAAAAA {{ winner }}';

const HOST = 'wss://irc-ws.chat.twitch.tv:443';
const IRC_MESSAGE_REGEXP = /:.*!/;
const PRIVMSG_PARSER = /^:(.*)!(.*)@(.*)\.tmi\.twitch\.tv\sPRIVMSG\s(#.*)\s:(.*)/;
const COMMAND_TO_LISTEN = '!winner';
const PING_REGEXP = /^PING\s:tmi\.twitch\.tv/;

const winnerMessageTemplate = Handlebars.compile(WINNER_MESSAGE);
const winnerMessageAnswerTemplate = Handlebars.compile(WINNER_MESSAGE_ANSWER);

class IRCBot {
  constructor() {
    this.ws = new WebSocket(HOST);
    this.ws.on('open', this.handleOpen.bind(this));
    this.ws.on('message', this.handleMessage.bind(this));

    this.PRIVMSGListener = null;
  }

  handleOpen() {
    this.ws.send(`PASS ${PASS}`);
    this.ws.send(`NICK ${NICK}`);
    this.ws.send(`CAP REQ :twitch.tv/membership`);
    this.ws.send(`CAP REQ :twitch.tv/commands`);
    this.ws.send(`CAP REQ :twitch.tv/tags`);
    this.ws.send(`JOIN ${CHANNEL}`);
  }

  _parseMessage(data) {
    const parts = data.split(' ');

    const tags = parts[0]
      .replace(/@/g, '')
      .split(';')
      .reduce((prev, current) => {
        const [key, value] = current.split('=');
        prev[key] = value;
        return prev;
      }, {});
  
    const message = data.substr(data.search(IRC_MESSAGE_REGEXP));
    const messageParts = message.match(PRIVMSG_PARSER);
  
    if (messageParts) {
      return {
        tags,
        username: messageParts[1],
        channel: messageParts[4],
        text: messageParts[5],
        isMod: /broadcaster|mod/.test(tags.badges),
      };
    }
  }

  onPRIVMSG(method) {
    this.PRIVMSGListener = method;
  }

  sendRAW(message) {
    console.log('<', message);
    this.ws.send(message);
  }


  handleMessage(data) {
    console.log('>', data);
    if (data.match(PING_REGEXP)) {
      return this.sendRAW('PONG :tmi.twitch.tv');
    }

    if (data.startsWith(':')) {
      return;
    }

    try {
      const messageObject = this._parseMessage(data);
      this.PRIVMSGListener(messageObject);
    } catch (error) {
      console.log('MESSAGE =>', data);
      console.error(error);
    }
  }

  sendPRIVMSG(channel, message) {
    this.sendRAW(`:${NICK}!${NICK}@${NICK}.tmi.twitch.tv PRIVMSG #${channel} :${message}`);
  }
}

class TwitchChatWinner {
  constructor() {
    this.bot = new IRCBot();

    this.bot.onPRIVMSG(this.onMessage.bind(this));

    this.winner = null;
    this.winnerTimeout = null;
  }

  async onMessage(messageObject) {
    if (!messageObject) {
      return;
    }

    if (messageObject.text === COMMAND_TO_LISTEN) {
      if (this.winnerTimeout) {
        return;
      }

      const channel = messageObject.channel.replace(/#/, '');
      const response = await axios({
        url: `http://tmi.twitch.tv/group/user/${channel}/chatters`,
      });
  
      const {
        viewers,
        vips,
      } = response.data.chatters;
  
      const allViewers = viewers.concat(vips);

      if (allViewers.length === 0) {
        return;
      }

      const winner = this.getRandomItem(allViewers);

      this.winner = String(winner).toLowerCase();

      this.bot.sendPRIVMSG(channel, winnerMessageTemplate({ winner }));

      this.winnerTimeout = setTimeout(() => {
        this.clearWinnerTimeout();
      }, WINNER_TIMEOUT * 1000);
      return;
    }

    if (messageObject.username.toLowerCase() === this.winner) {
      const channel = messageObject.channel.replace(/#/, '');
      this.bot.sendPRIVMSG(channel, `/timeout ${this.winner} ${WINNER_TIMEOUT}`);
      this.bot.sendPRIVMSG(channel, winnerMessageAnswerTemplate({ winner: this.winner }));
      this.clearWinnerTimeout();
    }
  }

  clearWinnerTimeout() {
    console.log('clearWinnerTimeout');
    clearTimeout(this.winnerTimeout);
    this.winner = null;
    this.winnerTimeout = null;
  }

  getRandomItem(items) {
    return items[_.random(0, items.length - 1)];
  }
}

new TwitchChatWinner();