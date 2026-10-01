// This file contains public configuration only. Never put credentials here.
window.TREE_CONFIG = Object.freeze({
  // "apps-script": one-page text + audio submission; "google-form": opens a form.
  mode: "apps-script",
  appsScriptUrl: "", // The deployed Google Apps Script /exec URL.
  googleFormUrl: "", // Optional fallback: the published responder URL.
  // For the fallback, map field names to observed entry IDs from a prefilled link.
  formFields: { name: "", email: "", nationality: "", studentId: "", language: "", mood: "", message: "", consent: "" },
  lineCommunityUrl: "https://line.me/ti/g2/OkLw7071VhAAEJP4AsO57MDP2BSlICvvnxL17w?utm_source=invitation&utm_medium=QR_code&utm_campaign=default",
  lineGroupUrl: ""
});
