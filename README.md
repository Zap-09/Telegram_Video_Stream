# Telegram Video Stream

### Table of content

- [About](#about)
- [Disclaimer](#-disclaimer)
- [Requirements](#requirements)
- [How to install](#how-to-install)
- [How to use](#how-to-use)

### About

<hr>
Use a Telegram channel as a lightweight video storage and stream it locally via a Quart server.

Telegram Video Stream allows you to use a Telegram channel as video storage. You can upload videos under 2GB and stream them through a Python Quart server running on your local network.

### ⚠️ Disclaimer

<hr>

1. While making this project AI was used, mostly on the front-end. So if you see CSS classes that adds the same styles
   but with different class name, now you know why.
   <br>

2. **This was made for local network usage only**. <br>There is no security safeguards in place. So anyone with the url
   can change/modify the server.

### Requirements

<hr>

1. You need to have Python installed in your machine. The versions I tested with and works are `3.10` and `3.13`. So Any
   version between them should work.<br>

2. Have a Telegram account, `API HASH` and `API ID`. You can get them on https://my.telegram.org/auth.

### How to install

<hr>

1. Clone/Download this repo.
2. Open a terminal inside the repo folder.
3. Run `pip install -r requirements.txt` or `pip install -r requirements.txt --no-deps` if you don't have
   `Microsoft Visual C++ Build Tools` installed.
4. Log in with your Telegram account on any browser. Make a new private channel and make sure it's a channel and not a
   group chat. Open the channel and copy the URL's last part with the bunch of numbers, it should look something like
   this `-321321321` and add `100` before it, So it becomes `-100321321321`
5. Make an `.env` file. Open it and copy all the contents of the `.env.example` and paste it there. And replace the
   placeholder data with your info. eg `API_ID`, `API_HASH`, `CHANNEL_ID`.
6. Now run `python login.py`. It should ask you for your phone number and password for the login. After you are done
   logging in there should be a `session.session` file.

### How to use

<hr>

1. Run `python login.py`. It should ask you for your phone number and password for the login. After you are done logging
   in there should be a `session.session` file. As long as you have this file you don't have to log-in again.
2. Now run `python main.py` it should start the quart server the default port is `8080`. To see your site go to
   `http://127.0.0.1:8080` if you are running this on the same device. If it's hosted on a different machine, run on a
   terminal `ipconfig` and look for `IPv4 Address` under `Wireless LAN adapter Wi-Fi`. take that number and `:8080` to
   it so it becomes somthing like ` 192.168.0.1:8080`.
