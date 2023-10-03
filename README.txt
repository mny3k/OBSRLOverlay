Welcome to the NEW MNCS Rocket League Overlay System!

Usage of this overlay is very simple. First, download and set up the main SOS relay plugin from https://gitlab.com/bakkesplugins/sos/sos-plugin. The setup is a little complicated, but there are multiple YT tutorials. You got this.
After that is installed, open the RLOverlay.json file in OBS, and make sure that it finds all the files. They should all be included in this package, so if you tell OBS to look through the top level folder, RLOverlay, it should work.
Next, be sure to enable the OBS Websocket, which is found under the Plugins dropdown at the top of your screen. Then, make sure that the Address is set to ws://127.0.0.1:4455, and that the password is set to obswsserver. 
The address and password can be changed in main.js if you wish. Once OBS is set up, simply open the index.html file in a browser (tested on Google Chrome, your mileage with other browsers may vary). 
From there, you will be able to set the game title, select teams, set player names and input their corresponding VDO.ninja links, then click Save. 
This will update the data in OBS automatically. Then start your game in Rocket League, and watch the magic happen!

This overlay system will take care of VDO Cameras, Post Game vids, music, and all the things that come with Rocket League automatically through the power of the OBS Websocket. 
That means, if you want to change something like a font, image, color, animation, or anything in between, you can do it natively in OBS, as long as you keep the names of scenes and sources the same. 
If you would like a more extensive write-up on why each thing is named the way it is, and what you can modify about it, I can do that.

Furthermore, if you have any questions, bug reports, suggestions, etc. please contact Mny3k on Discord. I will be happy to help.

Good luck!

Built by Nate Mny3k Sternberg
