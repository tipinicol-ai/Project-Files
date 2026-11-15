package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func setupAuth(t *testing.T, users map[string]string, key []byte) {
	t.Helper()
	oldState, oldKey, oldAdmin := state, sessionKey, adminUser
	oldDataDir, oldFilesDir := dataDir, filesDir
	dataDir = t.TempDir()
	filesDir = filepath.Join(dataDir, "files")
	if err := os.MkdirAll(filesDir, 0700); err != nil {
		t.Fatal(err)
	}
	state = State{Users: users, Posts: map[string]Post{}, Profiles: map[string]Profile{}, Wins: map[string]VictoryRecord{}}
	sessionKey = key
	adminUser = ""
	t.Cleanup(func() {
		state, sessionKey, adminUser, dataDir, filesDir = oldState, oldKey, oldAdmin, oldDataDir, oldFilesDir
	})
}

func TestMediaServesByteRangesForVideoFilenameWithSpaces(t *testing.T) {
	oldFilesDir := filesDir
	filesDir = t.TempDir()
	t.Cleanup(func() { filesDir = oldFilesDir })
	name := "preview clip de prueba.mp4"
	content := []byte("0123456789abcdefghijklmnop")
	if err := os.WriteFile(filepath.Join(filesDir, name), content, 0600); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodGet, "/media/"+url.PathEscape(name), nil)
	request.Header.Set("Range", "bytes=4-10")
	response := httptest.NewRecorder()
	media(response, request)
	if response.Code != http.StatusPartialContent {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusPartialContent)
	}
	if got := response.Header().Get("Content-Type"); got != "video/mp4" {
		t.Fatalf("Content-Type = %q, want video/mp4", got)
	}
	if got := response.Header().Get("Accept-Ranges"); got != "bytes" {
		t.Fatalf("Accept-Ranges = %q, want bytes", got)
	}
	if got := response.Body.String(); got != string(content[4:11]) {
		t.Fatalf("range body = %q, want %q", got, content[4:11])
	}
}

func TestHomeRendersMediaAndProfileForValidSignedSession(t *testing.T) {
	setupAuth(t, map[string]string{"gamer": hash("password")}, []byte("01234567890123456789012345678901"))
	state.Posts["video-id"] = Post{ID: "video-id", File: "preview clip.mp4", Caption: "Partida", Author: "gamer", Reactions: map[string]int{}, At: time.Now()}
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.AddCookie(&http.Cookie{Name: "pf_user", Value: signSession("gamer")})
	response := httptest.NewRecorder()
	home(response, request)
	body := response.Body.String()
	for _, want := range []string{`src="/assets/community-banner.webp"`, `<details class="profile">`, `<a class="profile-link" href="/logout">Cerrar sesión</a>`, `<video class="media" data-post="video-id" controls playsinline preload="metadata"`, `src="/media/preview%20clip.mp4"`, `name="file"`, `id="post-search"`} {
		if !strings.Contains(body, want) {
			t.Errorf("page missing %q", want)
		}
	}
	if strings.Contains(body, `href="/admin"`) {
		t.Error("ordinary users must not see the admin console link")
	}
}

func TestForgedSessionCookieIsRejected(t *testing.T) {
	setupAuth(t, map[string]string{"admin": hash("pw")}, []byte("01234567890123456789012345678901"))
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(&http.Cookie{Name: "pf_user", Value: "admin.not-a-signature"})
	if got := user(r); got != "" {
		t.Fatalf("forged session accepted as %q", got)
	}
}

func TestSignedSessionSupportsUsernameWithDot(t *testing.T) {
	setupAuth(t, map[string]string{"gamer.name": hash("pw")}, []byte("01234567890123456789012345678901"))
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(&http.Cookie{Name: "pf_user", Value: signSession("gamer.name")})
	if got := user(r); got != "gamer.name" {
		t.Fatalf("signed dotted username = %q, want gamer.name", got)
	}
}

func TestMediaRejectsMismatchedExtension(t *testing.T) {
	if _, err := validMedia("fake.png", bytes.NewReader([]byte("not an image"))); err == nil {
		t.Fatal("accepted non-image content with a PNG extension")
	}
}

func TestAdminRequiresExplicitConfiguredAccount(t *testing.T) {
	setupAuth(t, map[string]string{"player": hash("pw"), "admin": hash("pw")}, []byte("01234567890123456789012345678901"))
	request := httptest.NewRequest(http.MethodGet, "/admin", nil)
	request.AddCookie(&http.Cookie{Name: "pf_user", Value: signSession("player")})
	response := httptest.NewRecorder()
	admin(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("normal account admin status=%d, want 403", response.Code)
	}
	adminUser = "admin"
	request = httptest.NewRequest(http.MethodGet, "/admin", nil)
	request.AddCookie(&http.Cookie{Name: "pf_user", Value: signSession("admin")})
	response = httptest.NewRecorder()
	admin(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("configured admin status=%d, want 200", response.Code)
	}
}

func TestAdminCanAddManualLeaderboardNameAndWins(t *testing.T) {
	setupAuth(t, map[string]string{"admin": hash("pw"), "player": hash("pw")}, []byte("01234567890123456789012345678901"))
	adminUser = "admin"
	form := url.Values{"name": {"ClutchWolf"}, "wins": {"18"}}
	forged := httptest.NewRequest(http.MethodPost, "/admin/wins", strings.NewReader(form.Encode()))
	forged.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	forged.AddCookie(&http.Cookie{Name: "pf_user", Value: signSession("player")})
	denied := httptest.NewRecorder()
	adminWins(denied, forged)
	if denied.Code != http.StatusForbidden {
		t.Fatalf("ordinary account could modify wins: status=%d", denied.Code)
	}
	r := httptest.NewRequest(http.MethodPost, "/admin/wins", strings.NewReader(form.Encode()))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	r.AddCookie(&http.Cookie{Name: "pf_user", Value: signSession("admin")})
	w := httptest.NewRecorder()
	adminWins(w, r)
	if w.Code != http.StatusSeeOther {
		t.Fatalf("admin wins status=%d, body=%s", w.Code, w.Body.String())
	}
	record, ok := state.Wins["clutchwolf"]
	if !ok || record.Name != "ClutchWolf" || record.Wins != 18 || record.UpdatedBy != "admin" {
		t.Fatalf("manual win record was not saved with its audit data: %#v", record)
	}
	ranking := leaderboardLocked()
	if len(ranking) != 1 || ranking[0].User != "ClutchWolf" || ranking[0].Wins != 18 {
		t.Fatalf("manual name missing from public leaderboard: %#v", ranking)
	}
	edit := url.Values{"oldName": {"ClutchWolf"}, "name": {"ClutchWolf Pro"}, "wins": {"24"}}
	update := httptest.NewRequest(http.MethodPost, "/admin/wins", strings.NewReader(edit.Encode()))
	update.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	update.AddCookie(&http.Cookie{Name: "pf_user", Value: signSession("admin")})
	updated := httptest.NewRecorder()
	adminWins(updated, update)
	if updated.Code != http.StatusSeeOther || len(state.Wins) != 1 || state.Wins["clutchwolf pro"].Wins != 24 {
		t.Fatalf("manual leaderboard edit failed: status=%d records=%#v", updated.Code, state.Wins)
	}
}

func TestAdminConsoleLinkIsNotShownInProfile(t *testing.T) {
	setupAuth(t, map[string]string{"admin": hash("pw")}, []byte("01234567890123456789012345678901"))
	adminUser = "admin"
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(&http.Cookie{Name: "pf_user", Value: signSession("admin")})
	w := httptest.NewRecorder()
	home(w, r)
	if strings.Contains(w.Body.String(), `href="/admin"`) {
		t.Fatal("admin console link should not appear in the profile menu")
	}
}

func TestPublicProfileShowsIdentityPostsAndRanking(t *testing.T) {
	setupAuth(t, map[string]string{"viewer": hash("pw"), "alice": hash("pw")}, []byte("01234567890123456789012345678901"))
	state.Profiles["alice"] = Profile{Game: "Valorant", Bio: "Juego con la comunidad"}
	state.Posts["alice-post"] = Post{ID: "alice-post", File: "match.png", Caption: "¡GG equipo!", Author: "alice", At: time.Now(), Reactions: map[string]int{"gg": 4}, Comments: []Comment{{User: "viewer", Text: "Bien jugado"}}}
	state.Wins["alice"] = VictoryRecord{Name: "Alice", Wins: 12}
	r := httptest.NewRequest(http.MethodGet, "/user?name=alice", nil)
	r.AddCookie(&http.Cookie{Name: "pf_user", Value: signSession("viewer")})
	w := httptest.NewRecorder()
	viewProfile(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("profile status=%d, body=%s", w.Code, w.Body.String())
	}
	for _, want := range []string{"Juego con la comunidad", "Valorant", "¡GG equipo!", "#1", "12 victorias", "4", "1 comentarios"} {
		if !strings.Contains(w.Body.String(), want) {
			t.Errorf("profile missing %q", want)
		}
	}
}

func TestHomeShowsLeaderboardInDescendingWinOrder(t *testing.T) {
	setupAuth(t, map[string]string{"viewer": hash("pw")}, []byte("01234567890123456789012345678901"))
	state.Wins["runner"] = VictoryRecord{Name: "Runner", Wins: 3}
	state.Wins["champ"] = VictoryRecord{Name: "Champion", Wins: 20}
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(&http.Cookie{Name: "pf_user", Value: signSession("viewer")})
	w := httptest.NewRecorder()
	home(w, r)
	body := w.Body.String()
	champ, runner := strings.Index(body, ">Champion<"), strings.Index(body, ">Runner<")
	if champ < 0 || runner < 0 || champ >= runner {
		t.Fatalf("leaderboard did not put the highest-win player first: champion index=%d runner index=%d", champ, runner)
	}
}

func TestCommentRequiresExistingPostAndReturnsJSON(t *testing.T) {
	setupAuth(t, map[string]string{"gamer": hash("pw")}, []byte("01234567890123456789012345678901"))
	state.Posts["p"] = Post{ID: "p", Author: "gamer"}
	form := url.Values{"id": {"p"}, "text": {"GG buena partida"}}
	r := httptest.NewRequest(http.MethodPost, "/comment", strings.NewReader(form.Encode()))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	r.Header.Set("Accept", "application/json")
	r.AddCookie(&http.Cookie{Name: "pf_user", Value: signSession("gamer")})
	w := httptest.NewRecorder()
	comment(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("comment status=%d: %s", w.Code, w.Body.String())
	}
	var got Comment
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.User != "gamer" || got.Text != "GG buena partida" {
		t.Fatalf("unexpected comment: %#v", got)
	}
}

func TestReactionAjaxReturnsUpdatedCount(t *testing.T) {
	setupAuth(t, map[string]string{"gamer": hash("pw")}, []byte("01234567890123456789012345678901"))
	state.Posts["p"] = Post{ID: "p", Author: "gamer", Reactions: map[string]int{"gg": 2}}
	form := url.Values{"id": {"p"}, "key": {"gg"}}
	r := httptest.NewRequest(http.MethodPost, "/react", strings.NewReader(form.Encode()))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	r.Header.Set("Accept", "application/json")
	r.AddCookie(&http.Cookie{Name: "pf_user", Value: signSession("gamer")})
	w := httptest.NewRecorder()
	react(w, r)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"count":3`) {
		t.Fatalf("reaction AJAX response=%d %s", w.Code, w.Body.String())
	}
}

func TestDeleteOnlyAuthorCanDeletePost(t *testing.T) {
	setupAuth(t, map[string]string{"author": hash("pw"), "other": hash("pw")}, []byte("01234567890123456789012345678901"))
	state.Posts["p"] = Post{ID: "p", File: "old.mp4", Author: "author"}
	form := url.Values{"id": {"p"}}
	r := httptest.NewRequest(http.MethodPost, "/delete", strings.NewReader(form.Encode()))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	r.AddCookie(&http.Cookie{Name: "pf_user", Value: signSession("other")})
	w := httptest.NewRecorder()
	deletePost(w, r)
	if _, ok := state.Posts["p"]; !ok {
		t.Fatal("non-author deleted publication")
	}
}

func TestLogoutExpiresSessionCookie(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/logout", nil)
	response := httptest.NewRecorder()
	logout(response, request)
	if response.Code != http.StatusSeeOther || response.Header().Get("Location") != "/" {
		t.Fatalf("logout response=%d / %q", response.Code, response.Header().Get("Location"))
	}
	cookie := response.Result().Cookies()[0]
	if cookie.Name != "pf_user" || cookie.MaxAge >= 0 || !cookie.HttpOnly {
		t.Fatalf("session cookie not cleared securely: %#v", cookie)
	}
}

func TestEmbeddedAssetsAndInstallerIconExist(t *testing.T) {
	for _, name := range []string{"assets/login-banner.jpg", "assets/register-banner.webp", "assets/community-banner.webp", "assets/lite-social.css", "assets/app.js", "assets/admin.js", "assets/icon.png", "assets/icon.ico"} {
		if _, err := embeddedAssets.ReadFile(name); err != nil {
			t.Errorf("embedded asset %q: %v", name, err)
		}
	}
	if _, err := os.Stat("assets/icon.ico"); err != nil {
		t.Fatalf("installer icon missing: %v", err)
	}
}
