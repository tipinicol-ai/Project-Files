package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed assets/*
var embeddedAssets embed.FS

type Comment struct {
	User string
	Text string
	At   time.Time
}
type Post struct {
	ID, File, Caption, Author string
	Reactions                 map[string]int
	Comments                  []Comment
	At                        time.Time
}
type Profile struct {
	Game  string
	Photo string
	Bio   string
	Theme string
	Badge string
	Cover string
}
type VictoryRecord struct {
	Name      string
	Wins      int
	UpdatedBy string
	UpdatedAt time.Time
}
type State struct {
	Users    map[string]string
	Posts    map[string]Post
	Profiles map[string]Profile
	Wins     map[string]VictoryRecord
}

var mu sync.Mutex
var dataDir, filesDir, publicURL, adminUser string
var sessionKey []byte
var state = State{Users: map[string]string{}, Posts: map[string]Post{}, Profiles: map[string]Profile{}, Wins: map[string]VictoryRecord{}}
var reactions = []struct{ Key, Emoji, Label string }{{"fire", "🔥", "FUEGO"}, {"crit", "⚡", "CRIT"}, {"gg", "👍", "GG"}, {"heart", "❤️", "LOVE"}, {"lol", "😂", "LOL"}, {"wow", "😮", "WOW"}, {"ko", "😡", "KO"}}

const maxMediaSize int64 = 500 << 20
const maxAvatarSize int64 = 5 << 20

func main() {
	base, _ := os.UserConfigDir()
	dataDir = filepath.Join(base, "Project Files Social Server Lite")
	filesDir = filepath.Join(dataDir, "files")
	if err := os.MkdirAll(filesDir, 0700); err != nil {
		log.Fatal(err)
	}
	load()
	if err := loadSessionKey(); err != nil {
		log.Fatal(err)
	}
	adminUser = strings.ToLower(strings.TrimSpace(os.Getenv("PROJECT_FILES_ADMIN_USER")))
	http.Handle("/assets/", http.FileServer(http.FS(embeddedAssets)))
	http.HandleFunc("/", home)
	http.HandleFunc("/login", login)
	http.HandleFunc("/register", register)
	http.HandleFunc("/logout", logout)
	http.HandleFunc("/upload", upload)
	http.HandleFunc("/react", react)
	http.HandleFunc("/comment", comment)
	http.HandleFunc("/media/", media)
	http.HandleFunc("/admin", admin)
	http.HandleFunc("/admin/activity", adminActivity)
	http.HandleFunc("/admin/delete", adminDelete)
	http.HandleFunc("/admin/wins", adminWins)
	http.HandleFunc("/profile", profile)
	http.HandleFunc("/user", viewProfile)
	http.HandleFunc("/profile/photo", profilePhoto)
	http.HandleFunc("/profile/cover", profileCover)
	http.HandleFunc("/delete", deletePost)
	http.HandleFunc("/edit", editPost)
	port := "8787"
	if p := os.Getenv("PROJECT_FILES_PORT"); p != "" {
		port = p
	}
	url := "http://127.0.0.1:" + port
	ip := detectIP()
	publicURL = "http://" + ip + ":" + port
	log.Printf("==============================================")
	log.Printf(" PROJECT FILES SOCIAL SERVER LITE")
	log.Printf("==============================================")
	log.Printf("Estado: servidor social activo")
	log.Printf("Direccion web local: %s", publicURL)
	log.Printf("Solo este PC: %s", url)
	log.Printf("Panel admin: %s/admin (requiere PROJECT_FILES_ADMIN_USER)", url)
	log.Printf("Datos guardados en: %s", dataDir)
	log.Printf("Pulsa Ctrl+C para detener el servidor.")
	log.Fatal(http.ListenAndServe(":"+port, securityHeaders(http.DefaultServeMux)))
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "same-origin")
		next.ServeHTTP(w, r)
	})
}
func detectIP() string {
	ifaces, _ := net.Interfaces()
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			ip, _, err := net.ParseCIDR(addr.String())
			if err == nil && ip.To4() != nil {
				return ip.String()
			}
		}
	}
	return "127.0.0.1"
}
func hash(s string) string { b := sha256.Sum256([]byte(s)); return hex.EncodeToString(b[:]) }
func load() {
	b, e := os.ReadFile(filepath.Join(dataDir, "state.json"))
	if e == nil {
		if err := json.Unmarshal(b, &state); err != nil {
			log.Printf("No se pudo leer state.json: %v", err)
		}
	}
	if state.Users == nil {
		state.Users = map[string]string{}
	}
	if state.Posts == nil {
		state.Posts = map[string]Post{}
	}
	if state.Profiles == nil {
		state.Profiles = map[string]Profile{}
	}
	if state.Wins == nil {
		state.Wins = map[string]VictoryRecord{}
	}
}
func save() bool {
	b, e := json.MarshalIndent(state, "", "  ")
	if e != nil {
		return false
	}
	tmp := filepath.Join(dataDir, "state.json.tmp")
	if e = os.WriteFile(tmp, b, 0600); e != nil {
		return false
	}
	return os.Rename(tmp, filepath.Join(dataDir, "state.json")) == nil
}
func loadSessionKey() error {
	p := filepath.Join(dataDir, "session.key")
	b, e := os.ReadFile(p)
	if e == nil && len(b) == 32 {
		sessionKey = b
		return nil
	}
	if e != nil && !os.IsNotExist(e) {
		return e
	}
	b = make([]byte, 32)
	if _, e = rand.Read(b); e != nil {
		return e
	}
	if e = os.WriteFile(p, b, 0600); e != nil {
		return e
	}
	sessionKey = b
	return nil
}
func signSession(u string) string {
	m := hmac.New(sha256.New, sessionKey)
	_, _ = m.Write([]byte(u))
	return u + "." + hex.EncodeToString(m.Sum(nil))
}
func user(r *http.Request) string {
	c, e := r.Cookie("pf_user")
	if e != nil {
		return ""
	}
	separator := strings.LastIndex(c.Value, ".")
	if separator < 1 {
		return ""
	}
	name, encodedSignature := c.Value[:separator], c.Value[separator+1:]
	sig, e := hex.DecodeString(encodedSignature)
	if e != nil {
		return ""
	}
	m := hmac.New(sha256.New, sessionKey)
	_, _ = m.Write([]byte(name))
	if !hmac.Equal(sig, m.Sum(nil)) {
		return ""
	}
	mu.Lock()
	_, ok := state.Users[name]
	mu.Unlock()
	if !ok {
		return ""
	}
	return name
}
func setSession(w http.ResponseWriter, u string) {
	http.SetCookie(w, &http.Cookie{Name: "pf_user", Value: signSession(u), Path: "/", HttpOnly: true, Secure: false, SameSite: http.SameSiteLaxMode})
}
func redirect(w http.ResponseWriter, r *http.Request, to string) {
	http.Redirect(w, r, to, http.StatusSeeOther)
}
func isAdmin(u string) bool { return u != "" && adminUser != "" && strings.EqualFold(u, adminUser) }
func method(w http.ResponseWriter, r *http.Request, want string) bool {
	if r.Method != want {
		w.Header().Set("Allow", want)
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return false
	}
	return true
}

var profileThemes = []struct{ Key, Label string }{{"ocean", "Océano (clásico)"}, {"ember", "Fuego"}, {"forest", "Bosque"}, {"violet", "Violeta"}, {"sunset", "Atardecer"}}
var profileBadges = []struct{ Key, Label string }{{"", "Sin insignia"}, {"team", "🤝 Buen compañero"}, {"strategist", "⚡ Estratega"}, {"creator", "🎬 Creador"}, {"competitor", "🏆 Competidor"}, {"nightowl", "🌙 Noctámbulo"}}

func validTheme(theme string) bool {
	for _, item := range profileThemes {
		if item.Key == theme {
			return true
		}
	}
	return false
}
func validBadge(badge string) bool {
	for _, item := range profileBadges {
		if item.Key == badge {
			return true
		}
	}
	return false
}
func profileSelectOptions(items []struct{ Key, Label string }, selected string) string {
	var b strings.Builder
	for _, item := range items {
		mark := ""
		if item.Key == selected {
			mark = " selected"
		}
		b.WriteString(`<option value="` + template.HTMLEscapeString(item.Key) + `"` + mark + `>` + template.HTMLEscapeString(item.Label) + `</option>`)
	}
	return b.String()
}
func badgeHTML(badge string) string {
	for _, item := range profileBadges {
		if item.Key == badge && item.Key != "" {
			return `<span class="profile-badge">` + template.HTMLEscapeString(item.Label) + `</span>`
		}
	}
	return ""
}
func layout(title, body string) string { return layoutWithTheme(title, body, "ocean") }
func layoutWithTheme(title, body, theme string) string {
	if !validTheme(theme) {
		theme = "ocean"
	}
	doc := `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061722"><title>{{TITLE}} · Gamer Community</title><link rel="icon" type="image/png" href="/assets/icon.png"><link rel="stylesheet" href="/assets/lite-social.css"></head><body class="theme-{{THEME}}">{{BODY}}</body></html>`
	return strings.NewReplacer("{{TITLE}}", template.HTMLEscapeString(title), "{{THEME}}", theme, "{{BODY}}", body).Replace(doc)
}

type leaderboardEntry struct {
	User      string    `json:"user"`
	Wins      int       `json:"wins"`
	UpdatedBy string    `json:"updatedBy,omitempty"`
	UpdatedAt time.Time `json:"updatedAt,omitempty"`
}

func leaderboardLocked() []leaderboardEntry {
	return rankedWinsLocked(false)
}

func rankedWinsLocked(includeZero bool) []leaderboardEntry {
	entries := make([]leaderboardEntry, 0, len(state.Wins))
	for name, record := range state.Wins {
		if record.Wins > 0 || includeZero {
			shownName := record.Name
			if shownName == "" {
				shownName = name
			}
			entries = append(entries, leaderboardEntry{User: shownName, Wins: record.Wins, UpdatedBy: record.UpdatedBy, UpdatedAt: record.UpdatedAt})
		}
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Wins == entries[j].Wins {
			return strings.ToLower(entries[i].User) < strings.ToLower(entries[j].User)
		}
		return entries[i].Wins > entries[j].Wins
	})
	return entries
}

func home(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	u := user(r)
	if u == "" {
		auth(w, "login", "")
		return
	}
	mu.Lock()
	posts := make([]Post, 0, len(state.Posts))
	for _, p := range state.Posts {
		posts = append(posts, p)
	}
	profiles := make(map[string]Profile, len(state.Profiles))
	for name, pr := range state.Profiles {
		profiles[name] = pr
	}
	ranking := leaderboardLocked()
	prof := profiles[u]
	mu.Unlock()
	sort.Slice(posts, func(i, j int) bool { return posts[i].At.After(posts[j].At) })
	var b strings.Builder
	b.WriteString(fmt.Sprintf(`<header class="community-header"><img class="community-banner" src="/assets/community-banner.webp" alt="Gamer Community"><details class="profile"><summary aria-label="Mi perfil"><span class="profile-trigger">%s</span></summary><section class="profile-menu"><div class="profile-heading">%s<div><strong>%s</strong><small>Mi perfil</small></div></div><a class="profile-link" href="%s">Ver mi perfil público</a><form method="post" action="/profile"><label>Juego que juegas<input name="game" value="%s" maxlength="80" placeholder="Ej. Dota 2"></label><label>Sobre mí<textarea name="bio" maxlength="240" placeholder="Una breve presentación para la comunidad">%s</textarea></label><label>Color de mi comunidad<select name="theme">%s</select></label><label>Insignia decorativa<select name="badge">%s</select></label><button class="btn profile-save">Guardar perfil</button></form><form class="photo-form" method="post" action="/profile/photo" enctype="multipart/form-data"><label>Foto de perfil<input type="file" name="photo" accept="image/png,image/jpeg,image/webp" required></label><button class="btn profile-save">Cambiar foto</button></form><form class="photo-form" method="post" action="/profile/cover" enctype="multipart/form-data"><label>Portada del perfil<input type="file" name="cover" accept="image/png,image/jpeg,image/webp" required></label><button class="btn profile-save">Cambiar portada</button></form><a class="profile-link" href="/logout">Cerrar sesión</a></section></details></header><div class="community-layout"><aside class="leaderboard-panel" aria-labelledby="leaderboard-title"><div class="leaderboard-heading"><span class="leaderboard-kicker">CLASIFICACIÓN</span><h2 id="leaderboard-title">Top de victorias</h2><p>Los jugadores con más triunfos</p></div><ol class="leaderboard-list">`, avatarHTML(u, prof.Photo, "avatar"), avatarHTML(u, prof.Photo, "avatar"), template.HTMLEscapeString(u), profileURL(u), template.HTMLEscapeString(prof.Game), template.HTMLEscapeString(prof.Bio), profileSelectOptions(profileThemes, prof.Theme), profileSelectOptions(profileBadges, prof.Badge)))
	if len(ranking) == 0 {
		b.WriteString(`<li class="leaderboard-empty">Aún no hay victorias registradas.</li>`)
	} else {
		for i, entry := range ranking {
			b.WriteString(fmt.Sprintf(`<li class="leaderboard-entry%s"><span class="leaderboard-rank">%02d</span><span class="leaderboard-player"><strong>%s</strong><small>%s</small></span><span class="leaderboard-wins"><b>%d</b><small>victorias</small></span></li>`, map[bool]string{true: " is-champion", false: ""}[i == 0], i+1, template.HTMLEscapeString(entry.User), map[bool]string{true: "Líder actual", false: "En el ranking"}[i == 0], entry.Wins))
		}
	}
	b.WriteString(`</ol><p class="leaderboard-note">Actualizado por la administración</p></aside><main class="feed"><section class="composer neon-frame"><div class="avatar composer-avatar">` + avatarHTML(u, prof.Photo, "avatar-inner") + `</div><form action="/upload" method="post" enctype="multipart/form-data"><input name="caption" placeholder="¿Qué estás pensando hoy?" maxlength="2000" aria-label="Texto de la publicación"><label class="media-button"><span>＋ Añadir foto / vídeo</span><input type="file" name="file" accept="image/*,video/mp4,video/webm,video/ogg,.mp4,.m4v,.webm,.ogv,.ogg,.mov,.pdf,.zip" required></label><button class="btn publish-button">Publicar</button></form></section><section class="feed-tools"><label class="sr-only" for="post-search">Buscar publicaciones</label><input id="post-search" type="search" placeholder="Buscar publicaciones o autores…"><select id="post-filter" aria-label="Filtrar publicaciones"><option value="all">Todas</option><option value="video">Videos</option><option value="image">Imágenes</option></select></section><p class="empty-state" id="empty-state" hidden>No hay publicaciones que coincidan. ¡Sé el primero en compartir algo!</p>`)
	for _, p := range posts {
		fileURL := "/media/" + url.PathEscape(p.File)
		ext := strings.ToLower(filepath.Ext(p.File))
		kind := "file"
		if isVideoFile(ext) {
			kind = "video"
		} else if strings.HasPrefix(mime.TypeByExtension(ext), "image/") {
			kind = "image"
		}
		b.WriteString(`<article class="post neon-frame" data-kind="` + kind + `" data-search="` + template.HTMLEscapeString(strings.ToLower(p.Author+" "+p.Caption)) + `"><header class="post-header"><a class="post-author post-author-link" href="` + template.HTMLEscapeString(profileURL(p.Author)) + `">` + avatarHTML(p.Author, profiles[p.Author].Photo, "avatar post-avatar") + `<div><strong>` + template.HTMLEscapeString(p.Author) + `</strong><time datetime="` + p.At.Format(time.RFC3339) + `" title="` + p.At.Format("02/01/2006 15:04") + `">` + timeAgo(p.At) + `</time></div></a>`)
		if p.Author == u {
			b.WriteString(`<details class="post-menu"><summary aria-label="Opciones de publicación">•••</summary><div><button type="button" class="edit-open" data-id="` + template.HTMLEscapeString(p.ID) + `" data-caption="` + template.HTMLEscapeString(p.Caption) + `">Editar video</button><form method="post" action="/delete" onsubmit="return confirm('¿Eliminar esta publicación?')"><input type="hidden" name="id" value="` + template.HTMLEscapeString(p.ID) + `"><button>Eliminar</button></form></div></details>`)
		}
		b.WriteString(`</header>`)
		if p.Caption != "" {
			b.WriteString(`<p class="caption">` + template.HTMLEscapeString(p.Caption) + `</p>`)
		}
		if kind == "video" {
			b.WriteString(`<video class="media" data-post="` + template.HTMLEscapeString(p.ID) + `" controls playsinline preload="metadata" aria-label="Video publicado"><source src="` + template.HTMLEscapeString(fileURL) + `" type="` + template.HTMLEscapeString(videoContentType(ext)) + `">Tu navegador no puede reproducir este formato.</video><p class="media-error" hidden>No se pudo reproducir este video. Usa MP4 (H.264) o WebM.</p>`)
		} else if kind == "image" {
			b.WriteString(`<img class="media" src="` + template.HTMLEscapeString(fileURL) + `" alt="Imagen publicada" loading="lazy">`)
		} else {
			b.WriteString(`<p class="file-link">Archivo: <a href="` + template.HTMLEscapeString(fileURL) + `">` + template.HTMLEscapeString(p.File) + `</a></p>`)
		}
		b.WriteString(`<div class="reactions" aria-label="Reacciones">`)
		for _, x := range reactions {
			b.WriteString(fmt.Sprintf(`<form class="reaction-form" method="post" action="/react"><input type="hidden" name="id" value="%s"><input type="hidden" name="key" value="%s"><button class="reaction" title="%s" aria-label="%s"><span>%s</span><em>%d</em></button></form>`, template.HTMLEscapeString(p.ID), x.Key, x.Label, x.Label, x.Emoji, p.Reactions[x.Key]))
		}
		b.WriteString(`</div><div class="comments" data-post="` + template.HTMLEscapeString(p.ID) + `"><p class="comments-count">Comentarios (` + fmt.Sprint(len(p.Comments)) + `)</p><div class="comment-list">`)
		for _, c := range p.Comments {
			b.WriteString(`<div class="comment"><b>` + template.HTMLEscapeString(c.User) + `</b>` + template.HTMLEscapeString(c.Text) + `</div>`)
		}
		b.WriteString(`</div><form class="comment-form" method="post" action="/comment"><input type="hidden" name="id" value="` + template.HTMLEscapeString(p.ID) + `"><input name="text" maxlength="2000" required placeholder="Escribe un comentario…"><button class="btn comment-button">Comentar</button></form></div></article>`)
	}
	b.WriteString(`</main></div><dialog id="edit-dialog"><form method="post" action="/edit" enctype="multipart/form-data"><h2>Editar publicación</h2><input type="hidden" name="id"><label>Texto<textarea name="caption" maxlength="2000"></textarea></label><label>Reemplazar video o imagen (opcional)<input type="file" name="file" accept="image/*,video/mp4,video/webm,video/ogg,.mp4,.m4v,.webm,.ogv,.ogg,.mov"></label><div class="dialog-actions"><button type="button" class="btn dialog-cancel">Cancelar</button><button class="btn">Guardar cambios</button></div></form></dialog><footer class="feed-footer">Gamer Community · Tu nexo de juego local</footer><script src="/assets/app.js" defer></script>`)
	fmt.Fprint(w, layoutWithTheme("Gamer Community", b.String(), prof.Theme))
}
func avatarHTML(u, photo, cls string) string {
	if photo != "" {
		return `<img class="` + cls + `" src="/media/` + url.PathEscape(photo) + `" alt="Foto de ` + template.HTMLEscapeString(u) + `">`
	}
	return `<span class="` + cls + ` avatar-fallback">` + template.HTMLEscapeString(strings.ToUpper(firstRune(u))) + `</span>`
}
func firstRune(s string) string {
	r := []rune(s)
	if len(r) == 0 {
		return "P"
	}
	return string(r[0])
}

func profileURL(name string) string { return "/user?name=" + url.QueryEscape(name) }

func timeAgo(t time.Time) string {
	minutes := int(time.Since(t).Minutes())
	if minutes < 1 {
		return "Ahora"
	}
	if minutes < 60 {
		return fmt.Sprintf("Hace %d min", minutes)
	}
	hours := minutes / 60
	if hours < 24 {
		return fmt.Sprintf("Hace %d h", hours)
	}
	days := hours / 24
	if days < 7 {
		return fmt.Sprintf("Hace %d d", days)
	}
	return t.Format("02/01/2006")
}

func viewProfile(w http.ResponseWriter, r *http.Request) {
	if !method(w, r, http.MethodGet) {
		return
	}
	viewer := user(r)
	if viewer == "" {
		redirect(w, r, "/login")
		return
	}
	name := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("name")))
	mu.Lock()
	if _, exists := state.Users[name]; !exists {
		mu.Unlock()
		http.NotFound(w, r)
		return
	}
	profile := state.Profiles[name]
	posts := make([]Post, 0)
	for _, post := range state.Posts {
		if strings.EqualFold(post.Author, name) {
			posts = append(posts, post)
		}
	}
	profiles := make(map[string]Profile, len(state.Profiles))
	for account, item := range state.Profiles {
		profiles[account] = item
	}
	ranking := leaderboardLocked()
	mu.Unlock()
	sort.Slice(posts, func(i, j int) bool { return posts[i].At.After(posts[j].At) })
	reactionsCount, commentsCount := 0, 0
	for _, post := range posts {
		for _, count := range post.Reactions {
			reactionsCount += count
		}
		commentsCount += len(post.Comments)
	}
	place, winCount := 0, 0
	for i, entry := range ranking {
		if strings.EqualFold(entry.User, name) {
			place, winCount = i+1, entry.Wins
			break
		}
	}
	var b strings.Builder
	b.WriteString(`<header class="community-header"><a href="/"><img class="community-banner" src="/assets/community-banner.webp" alt="Gamer Community"></a></header><main class="public-profile-page"><a class="back-to-feed" href="/">← Volver a la comunidad</a><section class="public-profile-card">`)
	if profile.Cover != "" {
		b.WriteString(`<div class="profile-cover"><img src="/media/` + url.PathEscape(profile.Cover) + `" alt="Portada de ` + template.HTMLEscapeString(name) + `"></div>`)
	}
	b.WriteString(`<div class="public-profile-main">` + avatarHTML(name, profile.Photo, "avatar public-profile-avatar") + `<div class="public-profile-identity"><span class="profile-eyebrow">PERFIL DE LA COMUNIDAD</span><div class="profile-name-line"><h1>` + template.HTMLEscapeString(name) + `</h1>` + badgeHTML(profile.Badge) + `</div><p class="profile-game">`)
	if profile.Game != "" {
		b.WriteString(`<span class="game-tag">` + template.HTMLEscapeString(profile.Game) + `</span>`)
	} else {
		b.WriteString(`<span class="game-tag muted-tag">Aún no indica su juego</span>`)
	}
	b.WriteString(`</p><p class="profile-bio">`)
	if strings.TrimSpace(profile.Bio) != "" {
		b.WriteString(template.HTMLEscapeString(profile.Bio))
	} else {
		b.WriteString(`<span class="muted-copy">Todavía no agregó una presentación.</span>`)
	}
	b.WriteString(`</p></div></div><div class="profile-stats"><div><b>` + fmt.Sprint(len(posts)) + `</b><span>Publicaciones</span></div><div><b>` + fmt.Sprint(reactionsCount) + `</b><span>Reacciones</span></div><div><b>` + fmt.Sprint(commentsCount) + `</b><span>Comentarios</span></div><div class="profile-rank-stat"><b>`)
	if place > 0 {
		b.WriteString(fmt.Sprintf("#%d", place))
	} else {
		b.WriteString("—")
	}
	b.WriteString(`</b><span>`)
	if place > 0 {
		b.WriteString(fmt.Sprintf("%d victorias", winCount))
	} else {
		b.WriteString("Sin puesto aún")
	}
	b.WriteString(`</span></div></div></section><div class="profile-post-heading"><div><span class="profile-eyebrow">EN LA COMUNIDAD</span><h2>Publicaciones de ` + template.HTMLEscapeString(name) + `</h2></div><span class="profile-post-total">` + fmt.Sprint(len(posts)) + ` en total</span></div>`)
	if len(posts) == 0 {
		b.WriteString(`<div class="profile-empty"><strong>Este espacio está listo para su primera publicación.</strong><p>Cuando comparta algo, aparecerá aquí para la comunidad.</p></div>`)
	}
	for _, post := range posts {
		ext := strings.ToLower(filepath.Ext(post.File))
		mediaURL := "/media/" + url.PathEscape(post.File)
		b.WriteString(`<article class="profile-post"><header class="profile-post-header"><a class="post-author post-author-link" href="` + template.HTMLEscapeString(profileURL(name)) + `">` + avatarHTML(name, profiles[name].Photo, "avatar post-avatar") + `<div><strong>` + template.HTMLEscapeString(name) + `</strong><time datetime="` + post.At.Format(time.RFC3339) + `" title="` + post.At.Format("02/01/2006 15:04") + `">` + timeAgo(post.At) + `</time></div></a></header>`)
		if post.Caption != "" {
			b.WriteString(`<p class="profile-post-caption">` + template.HTMLEscapeString(post.Caption) + `</p>`)
		}
		if isVideoFile(ext) {
			b.WriteString(`<video class="profile-post-media" controls playsinline preload="metadata"><source src="` + template.HTMLEscapeString(mediaURL) + `" type="` + template.HTMLEscapeString(videoContentType(ext)) + `"></video>`)
		} else if strings.HasPrefix(mime.TypeByExtension(ext), "image/") {
			b.WriteString(`<img class="profile-post-media" src="` + template.HTMLEscapeString(mediaURL) + `" alt="Imagen de ` + template.HTMLEscapeString(name) + `" loading="lazy">`)
		} else {
			b.WriteString(`<a class="profile-file-link" href="` + template.HTMLEscapeString(mediaURL) + `">Abrir archivo compartido</a>`)
		}
		reactionTotal := 0
		for _, count := range post.Reactions {
			reactionTotal += count
		}
		b.WriteString(`<footer class="profile-post-footer"><span>♥ ` + fmt.Sprint(reactionTotal) + ` reacciones</span><span>` + fmt.Sprint(len(post.Comments)) + ` comentarios</span></footer></article>`)
	}
	b.WriteString(`<footer class="feed-footer">Gamer Community · Tu nexo de juego local</footer></main>`)
	fmt.Fprint(w, layoutWithTheme("Perfil de "+name, b.String(), profile.Theme))
}

func auth(w http.ResponseWriter, mode, msg string) {
	reg := mode == "register"
	title, action, subtitle, banner, foot := "Iniciar sesión", "/login", "Accede a tu cuenta", "/assets/login-banner.jpg", `<a href="/register">Crear una cuenta nueva</a>`
	if reg {
		title, action, subtitle, banner, foot = "Crear cuenta", "/register", "Únete a la comunidad", "/assets/register-banner.webp", `<a href="/login">Ya tengo cuenta</a>`
	}
	message := ""
	if msg != "" {
		message = `<p class="error">` + template.HTMLEscapeString(msg) + `</p>`
	}
	ph, ac := "Usuario o correo", "current-password"
	if reg {
		ph, ac = "Usuario", "new-password"
	}
	body := fmt.Sprintf(`<main class="auth-page"><img class="auth-banner" src="%s" alt="Gamer Community"><section class="auth-card"><h1>%s</h1><p class="auth-subtitle">%s</p>%s<form class="auth-form" method="post" action="%s"><label class="auth-field"><span aria-hidden="true">♧</span><input name="user" minlength="3" maxlength="40" placeholder="%s" autocomplete="username" required></label><label class="auth-field"><span aria-hidden="true">⚿</span><input type="password" name="pass" minlength="6" placeholder="Contraseña" autocomplete="%s" required></label><button class="btn auth-submit">%s</button></form><p class="auth-footer">%s</p></section></main>`, banner, title, subtitle, message, action, ph, ac, title, foot)
	fmt.Fprint(w, layout(title, body))
}
func login(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		auth(w, "login", "")
		return
	}
	if !method(w, r, http.MethodPost) {
		return
	}
	_ = r.ParseForm()
	u := strings.ToLower(strings.TrimSpace(r.FormValue("user")))
	mu.Lock()
	ok := state.Users[u] == hash(r.FormValue("pass"))
	mu.Unlock()
	if !ok {
		auth(w, "login", "Usuario o contraseña incorrectos")
		return
	}
	setSession(w, u)
	redirect(w, r, "/")
}
func register(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		auth(w, "register", "")
		return
	}
	if !method(w, r, http.MethodPost) {
		return
	}
	_ = r.ParseForm()
	u := strings.ToLower(strings.TrimSpace(r.FormValue("user")))
	mu.Lock()
	defer mu.Unlock()
	if len(u) < 3 || len(r.FormValue("pass")) < 6 || state.Users[u] != "" {
		auth(w, "register", "Usuario inválido o ya existente")
		return
	}
	state.Users[u] = hash(r.FormValue("pass"))
	if !save() {
		delete(state.Users, u)
		http.Error(w, "No se pudo guardar la cuenta", 500)
		return
	}
	setSession(w, u)
	redirect(w, r, "/")
}
func logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: "pf_user", Value: "", MaxAge: -1, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode})
	redirect(w, r, "/")
}
func validMedia(h string, file io.ReadSeeker) (string, error) {
	ext := strings.ToLower(filepath.Ext(filepath.Base(h)))
	ok := isVideoFile(ext) || strings.HasPrefix(mime.TypeByExtension(ext), "image/") || ext == ".pdf" || ext == ".zip"
	if !ok {
		return "", fmt.Errorf("formato de archivo no admitido")
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", err
	}
	header := make([]byte, 512)
	n, err := file.Read(header)
	if err != nil && err != io.EOF {
		return "", err
	}
	header = header[:n]
	valid := false
	switch ext {
	case ".jpg", ".jpeg":
		valid = bytes.HasPrefix(header, []byte{0xff, 0xd8, 0xff})
	case ".png":
		valid = bytes.HasPrefix(header, []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a})
	case ".webp":
		valid = len(header) >= 12 && string(header[:4]) == "RIFF" && string(header[8:12]) == "WEBP"
	case ".gif":
		valid = bytes.HasPrefix(header, []byte("GIF87a")) || bytes.HasPrefix(header, []byte("GIF89a"))
	case ".mp4", ".m4v", ".mov":
		valid = len(header) >= 8 && string(header[4:8]) == "ftyp"
	case ".webm":
		valid = bytes.HasPrefix(header, []byte{0x1a, 0x45, 0xdf, 0xa3})
	case ".ogv", ".ogg":
		valid = bytes.HasPrefix(header, []byte("OggS"))
	case ".pdf":
		valid = bytes.HasPrefix(header, []byte("%PDF-"))
	case ".zip":
		valid = len(header) >= 4 && string(header[:2]) == "PK" && (header[2] == 3 || header[2] == 5 || header[2] == 7)
	default:
		return "", fmt.Errorf("tipo de imagen no admitido")
	}
	if !valid {
		return "", fmt.Errorf("el contenido no coincide con la extensión del archivo")
	}
	return ext, nil
}
func storeUpload(src io.ReadSeeker, original string, limit int64) (string, error) {
	name := filepath.Base(strings.ReplaceAll(original, `\`, "/"))
	ext, err := validMedia(name, src)
	if err != nil {
		return "", err
	}
	if _, err = src.Seek(0, io.SeekStart); err != nil {
		return "", err
	}
	id := fmt.Sprintf("%d-%s", time.Now().UnixNano(), name)
	dst, err := os.OpenFile(filepath.Join(filesDir, id), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return "", err
	}
	n, err := io.Copy(dst, io.LimitReader(src, limit+1))
	ce := dst.Close()
	if err != nil || ce != nil || n > limit {
		_ = os.Remove(filepath.Join(filesDir, id))
		if n > limit {
			return "", fmt.Errorf("el archivo supera el límite permitido")
		}
		if err != nil {
			return "", err
		}
		return "", ce
	}
	_ = ext
	return id, nil
}
func upload(w http.ResponseWriter, r *http.Request) {
	u := user(r)
	if u == "" {
		redirect(w, r, "/login")
		return
	}
	if !method(w, r, http.MethodPost) {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxMediaSize+1<<20)
	if e := r.ParseMultipartForm(1 << 20); e != nil {
		http.Error(w, "La solicitud es demasiado grande", http.StatusRequestEntityTooLarge)
		return
	}
	f, h, e := r.FormFile("file")
	if e != nil {
		http.Error(w, "Selecciona un archivo", 400)
		return
	}
	defer f.Close()
	id, e := storeUpload(f, h.Filename, maxMediaSize)
	if e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	p := Post{ID: id, File: id, Caption: strings.TrimSpace(r.FormValue("caption")), Author: u, Reactions: map[string]int{}, At: time.Now()}
	mu.Lock()
	state.Posts[id] = p
	ok := save()
	if !ok {
		delete(state.Posts, id)
	}
	mu.Unlock()
	if !ok {
		_ = os.Remove(filepath.Join(filesDir, id))
		http.Error(w, "No se pudo guardar la publicación", 500)
		return
	}
	redirect(w, r, "/")
}
func profile(w http.ResponseWriter, r *http.Request) {
	u := user(r)
	if u == "" {
		redirect(w, r, "/login")
		return
	}
	if !method(w, r, http.MethodPost) {
		return
	}
	_ = r.ParseForm()
	bio := strings.TrimSpace(r.FormValue("bio"))
	theme := strings.TrimSpace(r.FormValue("theme"))
	if theme == "" {
		theme = "ocean"
	}
	badge := strings.TrimSpace(r.FormValue("badge"))
	if len([]rune(bio)) > 240 {
		http.Error(w, "La presentación no puede superar 240 caracteres", http.StatusBadRequest)
		return
	}
	if !validTheme(theme) || !validBadge(badge) {
		http.Error(w, "Tema o insignia no válidos", http.StatusBadRequest)
		return
	}
	mu.Lock()
	p := state.Profiles[u]
	original := p
	p.Game = strings.TrimSpace(r.FormValue("game"))
	p.Bio = bio
	p.Theme = theme
	p.Badge = badge
	state.Profiles[u] = p
	ok := save()
	if !ok {
		state.Profiles[u] = original
	}
	mu.Unlock()
	if !ok {
		http.Error(w, "No se pudo guardar el perfil", 500)
		return
	}
	redirect(w, r, "/")
}
func profilePhoto(w http.ResponseWriter, r *http.Request) { saveProfileImage(w, r, "photo") }
func profileCover(w http.ResponseWriter, r *http.Request) { saveProfileImage(w, r, "cover") }

func saveProfileImage(w http.ResponseWriter, r *http.Request, field string) {
	u := user(r)
	if u == "" {
		http.Error(w, "No autorizado", 401)
		return
	}
	if !method(w, r, http.MethodPost) {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxAvatarSize+1<<20)
	if e := r.ParseMultipartForm(1 << 20); e != nil {
		http.Error(w, "Imagen demasiado grande", 413)
		return
	}
	f, h, e := r.FormFile(field)
	if e != nil {
		http.Error(w, "Selecciona una imagen", 400)
		return
	}
	defer f.Close()
	ext := strings.ToLower(filepath.Ext(h.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
		http.Error(w, "Usa una imagen PNG, JPG o WebP", 400)
		return
	}
	id, e := storeUpload(f, h.Filename, maxAvatarSize)
	if e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	mu.Lock()
	p := state.Profiles[u]
	original := p
	old := p.Photo
	if field == "cover" {
		old = p.Cover
		p.Cover = id
	} else {
		p.Photo = id
	}
	state.Profiles[u] = p
	ok := save()
	if !ok {
		state.Profiles[u] = original
	}
	mu.Unlock()
	if !ok {
		_ = os.Remove(filepath.Join(filesDir, id))
		http.Error(w, "No se pudo guardar el perfil", 500)
		return
	}
	mu.Lock()
	referenced := isReferenced(old)
	mu.Unlock()
	if old != "" && !referenced {
		_ = os.Remove(filepath.Join(filesDir, old))
	}
	redirect(w, r, "/")
}
func isReferenced(file string) bool {
	for _, p := range state.Posts {
		if p.File == file {
			return true
		}
	}
	for _, p := range state.Profiles {
		if p.Photo == file || p.Cover == file {
			return true
		}
	}
	return false
}
func deletePost(w http.ResponseWriter, r *http.Request) {
	u := user(r)
	if u == "" {
		http.Error(w, "No autorizado", 401)
		return
	}
	if !method(w, r, http.MethodPost) {
		return
	}
	id := r.FormValue("id")
	mu.Lock()
	p, ok := state.Posts[id]
	if ok && p.Author == u {
		delete(state.Posts, id)
		if save() {
			if !isReferenced(p.File) {
				_ = os.Remove(filepath.Join(filesDir, p.File))
			}
		} else {
			state.Posts[id] = p
		}
	}
	mu.Unlock()
	redirect(w, r, "/")
}
func editPost(w http.ResponseWriter, r *http.Request) {
	u := user(r)
	if u == "" {
		http.Error(w, "No autorizado", 401)
		return
	}
	if !method(w, r, http.MethodPost) {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxMediaSize+1<<20)
	if e := r.ParseMultipartForm(1 << 20); e != nil {
		http.Error(w, "Solicitud demasiado grande", 413)
		return
	}
	id := r.FormValue("id")
	mu.Lock()
	p, ok := state.Posts[id]
	if !ok || p.Author != u {
		mu.Unlock()
		http.Error(w, "Publicación no encontrada o sin permiso", 403)
		return
	}
	original := p
	old := p.File
	p.Caption = strings.TrimSpace(r.FormValue("caption"))
	f, h, e := r.FormFile("file")
	if e == nil {
		newID, err := storeUpload(f, h.Filename, maxMediaSize)
		_ = f.Close()
		if err != nil {
			mu.Unlock()
			http.Error(w, err.Error(), 400)
			return
		}
		p.File = newID
	}
	state.Posts[id] = p
	saved := save()
	if !saved {
		state.Posts[id] = original
		mu.Unlock()
		if p.File != old {
			_ = os.Remove(filepath.Join(filesDir, p.File))
		}
		http.Error(w, "No se pudieron guardar los cambios", 500)
		return
	}
	if old != p.File && !isReferenced(old) {
		_ = os.Remove(filepath.Join(filesDir, old))
	}
	mu.Unlock()
	redirect(w, r, "/")
}
func react(w http.ResponseWriter, r *http.Request) {
	u := user(r)
	if u == "" {
		redirect(w, r, "/login")
		return
	}
	if !method(w, r, http.MethodPost) {
		return
	}
	mu.Lock()
	id := r.FormValue("id")
	key := r.FormValue("key")
	p, ok := state.Posts[id]
	if !ok {
		mu.Unlock()
		http.NotFound(w, r)
		return
	}
	validKey := false
	for _, reaction := range reactions {
		if reaction.Key == key {
			validKey = true
			break
		}
	}
	if !validKey {
		mu.Unlock()
		http.Error(w, "Reacción no válida", http.StatusBadRequest)
		return
	}
	original := p
	if p.Reactions != nil {
		original.Reactions = make(map[string]int, len(p.Reactions))
		for reactionKey, count := range p.Reactions {
			original.Reactions[reactionKey] = count
		}
	}
	if p.Reactions == nil {
		p.Reactions = map[string]int{}
	}
	p.Reactions[key]++
	state.Posts[id] = p
	if !save() {
		state.Posts[id] = original
		mu.Unlock()
		http.Error(w, "No se pudo guardar la reacción", 500)
		return
	}
	count := p.Reactions[key]
	mu.Unlock()
	if strings.Contains(r.Header.Get("Accept"), "application/json") {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"key": key, "count": count})
		return
	}
	redirect(w, r, "/")
}
func comment(w http.ResponseWriter, r *http.Request) {
	u := user(r)
	if u == "" {
		http.Error(w, "Inicia sesión", 401)
		return
	}
	if !method(w, r, http.MethodPost) {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	_ = r.ParseForm()
	text := strings.TrimSpace(r.FormValue("text"))
	if text == "" || len([]rune(text)) > 2000 {
		http.Error(w, "Comentario vacío o demasiado largo", 400)
		return
	}
	mu.Lock()
	id := r.FormValue("id")
	p, ok := state.Posts[id]
	if !ok {
		mu.Unlock()
		http.NotFound(w, r)
		return
	}
	c := Comment{User: u, Text: text, At: time.Now()}
	original := p
	p.Comments = append(p.Comments, c)
	state.Posts[id] = p
	saved := save()
	if !saved {
		state.Posts[id] = original
	}
	mu.Unlock()
	if !saved {
		http.Error(w, "No se pudo guardar el comentario", 500)
		return
	}
	if strings.Contains(r.Header.Get("Accept"), "application/json") {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(c)
		return
	}
	redirect(w, r, "/")
}
func isVideoFile(ext string) bool { return videoContentType(ext) != "" }
func videoContentType(ext string) string {
	switch strings.ToLower(ext) {
	case ".mp4", ".m4v":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".ogv", ".ogg":
		return "video/ogg"
	case ".mov":
		return "video/quicktime"
	}
	return ""
}
func media(w http.ResponseWriter, r *http.Request) {
	name := filepath.Base(strings.TrimPrefix(r.URL.Path, "/media/"))
	if name == "." || name == "/" || name == "" {
		http.NotFound(w, r)
		return
	}
	f, err := os.Open(filepath.Join(filesDir, name))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}
	ext := strings.ToLower(filepath.Ext(name))
	ct := videoContentType(ext)
	if ct == "" {
		ct = mime.TypeByExtension(ext)
	}
	if ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, name, info.ModTime(), f)
}
func adminAuth(w http.ResponseWriter, r *http.Request) bool {
	u := user(r)
	if !isAdmin(u) {
		http.Error(w, "Acceso administrativo no autorizado. Configura PROJECT_FILES_ADMIN_USER con una cuenta existente.", http.StatusForbidden)
		return false
	}
	return true
}
func admin(w http.ResponseWriter, r *http.Request) {
	if !adminAuth(w, r) {
		return
	}
	mu.Lock()
	postCount, userCount := len(state.Posts), len(state.Users)
	mu.Unlock()
	body := fmt.Sprintf(`<header class="admin-header"><a href="/"><img src="/assets/community-banner.webp" alt="Gamer Community"></a></header><main class="feed admin-page"><section class="post admin-card"><h1>Consola de administración</h1><p>Servidor social Project Files Social Server Lite</p><p class="url">%s</p><p>Publicaciones: <strong>%d</strong> · Usuarios: <strong>%d</strong></p><h2>Top de victorias</h2><p>Escribe cualquier nombre o alias y su número de victorias. No hace falta que tenga una cuenta; estos datos son los que aparecerán en la web.</p><form class="admin-win-create" method="post" action="/admin/wins"><label>Nombre del jugador<input name="name" maxlength="60" placeholder="Ej. ProGamer" required></label><label>Victorias<input type="number" name="wins" min="0" max="1000000" step="1" value="0" required></label><button class="btn">Agregar al ranking</button></form><div class="admin-wins" id="admin-wins">Cargando jugadores…</div><h2>Actividad reciente</h2><label class="admin-search-label">Buscar autor o texto<input id="admin-search" type="search" placeholder="Buscar en las últimas publicaciones…"></label><div class="admin-posts" id="admin-posts">Cargando actividad…</div><h2>Usuarios registrados</h2><div class="admin-users" id="admin-users"></div><a class="profile-link" href="/">Volver a la comunidad</a></section></main><script src="/assets/admin.js" defer></script>`, template.HTMLEscapeString(publicURL), postCount, userCount)
	fmt.Fprint(w, layout("Administración", body))
}
func adminActivity(w http.ResponseWriter, r *http.Request) {
	if !adminAuth(w, r) {
		return
	}
	mu.Lock()
	posts := make([]Post, 0, len(state.Posts))
	for _, p := range state.Posts {
		posts = append(posts, p)
	}
	users := make([]string, 0, len(state.Users))
	for u := range state.Users {
		users = append(users, u)
	}
	ranking := rankedWinsLocked(true)
	mu.Unlock()
	sort.Slice(posts, func(i, j int) bool { return posts[i].At.After(posts[j].At) })
	if len(posts) > 20 {
		posts = posts[:20]
	}
	sort.Strings(users)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"posts": posts, "users": users, "wins": ranking})
}
func adminDelete(w http.ResponseWriter, r *http.Request) {
	if !adminAuth(w, r) {
		return
	}
	if !method(w, r, http.MethodPost) {
		return
	}
	id := r.FormValue("id")
	mu.Lock()
	p, ok := state.Posts[id]
	if ok {
		delete(state.Posts, id)
		if save() {
			if !isReferenced(p.File) {
				_ = os.Remove(filepath.Join(filesDir, p.File))
			}
		} else {
			state.Posts[id] = p
		}
	}
	mu.Unlock()
	redirect(w, r, "/admin")
}

func adminWins(w http.ResponseWriter, r *http.Request) {
	if !adminAuth(w, r) {
		return
	}
	actor := user(r)
	if !method(w, r, http.MethodPost) {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Formulario inválido", http.StatusBadRequest)
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	key := strings.ToLower(name)
	oldKey := strings.ToLower(strings.TrimSpace(r.FormValue("oldName")))
	if name == "" || len([]rune(name)) > 60 {
		http.Error(w, "El nombre debe tener entre 1 y 60 caracteres", http.StatusBadRequest)
		return
	}
	wins, err := strconv.Atoi(r.FormValue("wins"))
	if err != nil || wins < 0 || wins > 1000000 {
		http.Error(w, "Las victorias deben ser un número entre 0 y 1.000.000", http.StatusBadRequest)
		return
	}
	mu.Lock()
	if oldKey != "" && oldKey != key {
		if _, exists := state.Wins[oldKey]; !exists {
			mu.Unlock()
			http.Error(w, "No se encontró el jugador que quieres editar", http.StatusBadRequest)
			return
		}
		if _, exists := state.Wins[key]; exists {
			mu.Unlock()
			http.Error(w, "Ya existe un jugador con ese nombre", http.StatusBadRequest)
			return
		}
	}
	previousWins := make(map[string]VictoryRecord, len(state.Wins))
	for savedName, record := range state.Wins {
		previousWins[savedName] = record
	}
	if oldKey != "" && oldKey != key {
		delete(state.Wins, oldKey)
	}
	state.Wins[key] = VictoryRecord{Name: name, Wins: wins, UpdatedBy: actor, UpdatedAt: time.Now()}
	saved := save()
	if !saved {
		state.Wins = previousWins
	}
	mu.Unlock()
	if !saved {
		http.Error(w, "No se pudieron guardar las victorias", http.StatusInternalServerError)
		return
	}
	redirect(w, r, "/admin")
}
