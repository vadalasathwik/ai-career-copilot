import dns from "dns"
import { promisify } from "util"

const lookupAsync = promisify(dns.lookup)

export interface JobUrlFetchResult {
  success: boolean
  url: string
  title?: string
  company?: string
  description?: string
  canPasteManually: boolean
  message?: string
}

/**
 * Checks if an IP address string belongs to a private, loopback, or internal range.
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 loopback
  if (ip.startsWith("127.")) return true
  // IPv4 zero network
  if (ip.startsWith("0.")) return true
  // IPv4 private ranges (RFC 1918)
  if (ip.startsWith("10.")) return true
  if (ip.startsWith("192.168.")) return true
  // 172.16.0.0 - 172.31.255.255
  const parts = ip.split(".").map(Number)
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true
  }
  // Link-local / Cloud metadata (169.254.0.0/16)
  if (ip.startsWith("169.254.")) return true

  // IPv6 loopback / internal
  if (ip === "::1" || ip === "::") return true
  // IPv6 ULA (fc00::/7)
  if (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd")) return true
  // IPv6 link-local (fe80::/10)
  if (ip.toLowerCase().startsWith("fe80:")) return true

  return false
}

/**
 * Validates a URL against SSRF attacks (blocking localhost, private IPs, internal schemes).
 */
export async function validateJobUrl(urlString: string): Promise<{ valid: boolean; error?: string; parsedUrl?: URL }> {
  let parsed: URL
  try {
    parsed = new URL(urlString.trim())
  } catch {
    return { valid: false, error: "Invalid URL syntax. Please enter a valid HTTP or HTTPS job link." }
  }

  // Only allow HTTP and HTTPS
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only HTTP and HTTPS URLs are allowed." }
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block localhost and common local names
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "0.0.0.0"
  ) {
    return { valid: false, error: "Access to local or internal addresses is blocked for security." }
  }

  // Check if hostname is directly an IP
  if (isPrivateIp(hostname)) {
    return { valid: false, error: "Access to private network addresses is blocked for security." }
  }

  // Resolve hostname via DNS to verify resolved IPs
  try {
    const lookupResult = await lookupAsync(hostname, { all: true })
    const records = Array.isArray(lookupResult) ? lookupResult : [lookupResult]

    for (const record of records) {
      if (isPrivateIp(record.address)) {
        return { valid: false, error: "Access to private or internal services is blocked for security." }
      }
    }
  } catch (err) {
    return { valid: false, error: `Could not resolve domain name: ${err instanceof Error ? err.message : "DNS lookup failed"}` }
  }

  return { valid: true, parsedUrl: parsed }
}

/**
 * Strips HTML tags, script, style, and navigation elements to extract clean readable text.
 */
function extractTextFromHtml(html: string): { title?: string; company?: string; text: string } {
  // Extract Title
  let title: string | undefined
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
  if (ogTitleMatch && ogTitleMatch[1]) {
    title = ogTitleMatch[1].trim()
  } else {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim()
    }
  }

  // Extract Company Name
  let company: string | undefined
  const ogSiteMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)
  if (ogSiteMatch && ogSiteMatch[1]) {
    company = ogSiteMatch[1].trim()
  }

  // Clean title if it contains delimiter (e.g., "Full Stack Engineer | Apex Systems")
  if (title) {
    const titleParts = title.split(/[|\-–•]/)
    if (titleParts.length > 1 && !company) {
      company = titleParts[titleParts.length - 1].trim()
    }
  }

  // Strip scripts, styles, svgs, header, footer, nav
  let cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")

  // Replace block tags with newlines
  cleanHtml = cleanHtml
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, "\n")
    .replace(/<br\s*[\/]?>/gi, "\n")

  // Remove remaining HTML tags
  cleanHtml = cleanHtml.replace(/<[^>]+>/g, " ")

  // Decode common HTML entities
  const decoded = cleanHtml
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")

  // Collapse excessive whitespace while preserving paragraph breaks
  const lines = decoded
    .split("\n")
    .map((l) => l.trim().replace(/\s+/g, " "))
    .filter((l) => l.length > 0)

  return {
    title,
    company,
    text: lines.join("\n\n")
  }
}

/**
 * Safely fetches and parses job description content from a user-supplied URL.
 * Applies strict timeouts, response-size limits, and bot-blocking detection.
 */
export async function fetchJobContentFromUrl(urlString: string): Promise<JobUrlFetchResult> {
  const validation = await validateJobUrl(urlString)
  if (!validation.valid || !validation.parsedUrl) {
    return {
      success: false,
      url: urlString,
      canPasteManually: true,
      message: validation.error || "Invalid or disallowed job URL."
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(urlString, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    })

    clearTimeout(timeoutId)

    // Handle bot walls, auth walls, and paywalls (e.g. LinkedIn authwall, Naukri login wall, Cloudflare)
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 429 ||
      response.status === 503
    ) {
      return {
        success: false,
        url: urlString,
        canPasteManually: true,
        message:
          "This job board requires an account login or blocks automated readers. Please copy and paste the job description text manually below."
      }
    }

    if (!response.ok) {
      return {
        success: false,
        url: urlString,
        canPasteManually: true,
        message: `Could not load job page (HTTP ${response.status}). Please paste the job description text manually below.`
      }
    }

    // Read response with 1 MB size limit
    const reader = response.body?.getReader()
    if (!reader) {
      return {
        success: false,
        url: urlString,
        canPasteManually: true,
        message: "No readable content returned from job page. Please paste the job description manually."
      }
    }

    const chunks: Uint8Array[] = []
    let totalBytes = 0
    const MAX_BYTES = 1024 * 1024 // 1 MB

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        totalBytes += value.length
        chunks.push(value)
        if (totalBytes > MAX_BYTES) {
          reader.cancel()
          break
        }
      }
    }

    const decoder = new TextDecoder("utf-8")
    const html = decoder.decode(Buffer.concat(chunks))

    // Detect common anti-bot or login wall phrases
    const lowerHtml = html.toLowerCase()
    if (
      lowerHtml.includes("join linkedin") ||
      lowerHtml.includes("sign in to linkedin") ||
      lowerHtml.includes("please verify you are a human") ||
      lowerHtml.includes("cloudflare ray id") ||
      lowerHtml.includes("attention required! | cloudflare") ||
      lowerHtml.includes("enable javascript and cookies to continue")
    ) {
      return {
        success: false,
        url: urlString,
        canPasteManually: true,
        message:
          "This job posting is behind a sign-in wall or bot protection. Please copy and paste the job description text directly into the text box below."
      }
    }

    const extracted = extractTextFromHtml(html)

    if (!extracted.text || extracted.text.length < 50) {
      return {
        success: false,
        url: urlString,
        canPasteManually: true,
        message:
          "We could not extract a full job description from this page. Please paste the job description text directly into the text box below."
      }
    }

    // Limit text to 20,000 characters
    const cleanDescription = extracted.text.slice(0, 20000)

    return {
      success: true,
      url: urlString,
      title: extracted.title,
      company: extracted.company,
      description: cleanDescription,
      canPasteManually: false
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("aborted") || msg.includes("Timeout")) {
      return {
        success: false,
        url: urlString,
        canPasteManually: true,
        message:
          "Connecting to the job posting timed out (8s limit). Please paste the job description text manually below."
      }
    }

    return {
      success: false,
      url: urlString,
      canPasteManually: true,
      message: `Failed to load job page: ${msg}. Please paste the job description text manually below.`
    }
  }
}
