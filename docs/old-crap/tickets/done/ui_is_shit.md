
the current app ux is shit, and here is a rough outline of how we will fix it.

## source ui
- ...should be a crud for clearly defined units of "backed up folders"
  - trash the new folder setup procedure completely, its the absolute worst it could possibly be
  - to do this better, open a new modal page specifically for this, then show all the settings compactly and in the order the user would review them, with the save button on the top right as it is custommary on many apps, and for good measure also have a save button on the very bottom. We can fit local folder, remote folder, and some basic settings on the same page.
  - new files vs include existing files choice was supposed to be in reference to pictures that are already on the server, but get detected again for whatever reason. We will ALWAYS detect the old images on the phone from now on, and we will always clobber the server files if local version is older. For edge cases like a TODO list file on the phone, which the user edits in-place regularily, we will offer the non-default option of making a renamed copy on the server. Done! No more bullshit. 
  - Backing up the "default folders" (Pictures and Whatnot) (never call it default folders, or talk about how they are special in android) should just be a preset to start a new folder setup procedure, but obviously those will skip the native "give permission for specific folder" dialog. 

# actvitiy ui
- should be an upload history, per file (collapsed after >20, but expandable for checking specific images). Show all images on server and local phone as thumbs, then slap icons on top to communicate if they are up only, down only, or both.

# setings


# general

- top right hamburger should be THE CONNECTED NEXTCLOUDS icon instead of this shitty hamburger menu
  - and then when clicking, open a dedicated modal page where we can edit account settings in-place. Have a link to this modal in settings as well.
