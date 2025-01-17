
# Project Plus (Weatherscan Local)

This is a recreated emulator of The Weather Channel's discontinued Weatherscan Local wich ran in the late 1990s through early 2000s, eventually being rebranded to Weatherscan which was discontinued on December 14th 2022. This was all made by tyetenna. This was modified by me. 


## Disclaimer

This is a very early version of the simulator, and is prone to bugs and errors. If you spot any, or have any ideas, please feel free to submit them on the Issues tab up above!
## Demo

You can access a live demo at https://dewpoint.team/, and you can specify a location by adding a "?" followed by a location name or zip code to the end (i.e https://dewpoint.team/?Madison)


## Authors

Team Dew Point
    - [@tyetenna](https://www.github.com/tyetenna)/[TyeWx](https://youtube.com/@TyeWx) & Others

## Acknowledgements

 - [Goldblaze's Weatherscan Simulator](https://github.com/buffbears/Weatherscan) for inspring this project
 - Massive thanks to pjfrix's [TWC Resource Sheet](https://docs.google.com/spreadsheets/d/1FZCfi74ZGlmEVco4uHBq-Fe22avggDXJaSDa0CC7USo) for sources to the original images



## Run Locally

1. Download and install [Node.JS](https://nodejs.org/en)

2. Acquire weather.com/IBM and mapbox.com API keys. (WE WILL NOT ASSIST WITH ACQUIRING THESE)

3. Open config.js and enter your weather.com/IBM API key

4. Open newradar.js and enter your mapbox.com key

3. Install dependencies

```bash
  npm install package.json
```

4. Start the server

```bash
  node ./server.js
```

5. The server should now be running on localhost, port 3000!
