// api/_supabase.js
// Server-side Supabase REST helper.
//
// Required Vercel environment variables:
//
// SUPABASE_URL
// SUPABASE_SECRET_KEY
//
// NEVER expose SUPABASE_SECRET_KEY in index.html.

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY;


/* =========================================
   CHECK ENVIRONMENT VARIABLES
========================================= */

function ensureEnv() {

  if (
    !SUPABASE_URL ||
    !SUPABASE_KEY
  ) {

    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY in Vercel environment variables."
    );
  }
}


/* =========================================
   SUPABASE REST REQUEST
========================================= */

async function supabaseRest(
  path,
  options = {}
) {

  ensureEnv();


  const response =
    await fetch(
      `${SUPABASE_URL}/rest/v1/${path}`,
      {

        ...options,

        headers: {

          /*
            New Supabase secret keys
            use the apikey header.
          */

          apikey:
            SUPABASE_KEY,


          "Content-Type":
            "application/json",


          /*
            Allows individual API calls
            to add headers such as:

            Prefer: return=representation
          */

          ...(options.headers || {})
        }
      }
    );


  /* =====================================
     READ RESPONSE
  ===================================== */

  const text =
    await response.text();


  let body = null;


  if (text) {

    try {

      body =
        JSON.parse(text);

    }

    catch {

      body =
        text;
    }
  }


  /* =====================================
     HANDLE SUPABASE ERRORS
  ===================================== */

  if (!response.ok) {

    const detail =

      typeof body === "object"

        ? body?.message ||
          body?.details ||
          body?.hint ||
          JSON.stringify(body)

        : String(
            body ||
            response.statusText
          );


    throw new Error(
      `Supabase error ${response.status}: ${detail}`
    );
  }


  return body;
}


/* =========================================
   EXPORT
========================================= */

module.exports = {
  supabaseRest
};
