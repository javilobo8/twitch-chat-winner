# twitch-chat-winner

A Twitch bot that bans a random user from chat

# Run

Environment variables
```
TCW_CHANNEL=#somechannel
TCW_NICK=yournick
TCW_PASS=oauth:youroauthtoken
TCW_WINNER_TIMEOUT=60 # Timeout in seconds
TCW_WINNER_MESSAGE=Some template # Template string compiled with Handlebars, { winner }
TCW_WINNER_MESSAGE_ANSWER=Some template # Template string compiled with Handlebars, { winner }
```