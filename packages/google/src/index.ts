type PlaceholderResult = {
  ok: true;
  provider: "google";
  action: string;
  TODO: string;
};

function placeholder(action: string): PlaceholderResult {
  // TODO: Configure OAuth scopes, service account delegation, and Google API clients using environment variables only.
  // TODO: Required future scopes include Drive file access, Docs, Slides, and Gmail compose. Request them only when the feature needs them.
  return {
    ok: true,
    provider: "google",
    action,
    TODO: "Configure OAuth scopes, service account delegation, and Google API clients using environment variables only."
  };
}

export async function createDriveFolder() {
  return placeholder("createDriveFolder");
}

export async function searchDriveFolder() {
  return placeholder("searchDriveFolder");
}

export async function createGoogleDoc() {
  return placeholder("createGoogleDoc");
}

export async function updateGoogleDoc() {
  return placeholder("updateGoogleDoc");
}

export async function createGoogleSlideDeck() {
  return placeholder("createGoogleSlideDeck");
}

export async function updateGoogleSlides() {
  return placeholder("updateGoogleSlides");
}

export async function createGmailDraft() {
  return placeholder("createGmailDraft");
}

export async function saveGeneratedFileToDrive() {
  return placeholder("saveGeneratedFileToDrive");
}
