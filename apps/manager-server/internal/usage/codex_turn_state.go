package usage

import "encoding/json"

// Codex request observations share the existing metadata JSON column so old
// events remain unknown without a migration or a current-cache backfill.
const maxCodexRequestTicketLength = 64 * 1024

func sanitizeCodexTurnState(state *HeaderCodexTurnStateMetadata) *HeaderCodexTurnStateMetadata {
	if state == nil {
		return nil
	}
	validRequest := false
	if state.RequestLength != nil {
		length := *state.RequestLength
		switch state.RequestSource {
		case "cache", "passthrough":
			validRequest = length > 0 && length <= maxCodexRequestTicketLength
		case "none":
			validRequest = length == 0
		}
	}
	validRequest = validRequest && (state.RequestScope == "" || state.RequestScope == "websocket_handshake")
	if !validRequest {
		state.RequestLength = nil
		state.RequestSource = ""
		state.RequestScope = ""
	}
	if state.ResponseLength <= 0 {
		state.ResponseLength = 0
	}
	if !validRequest && state.ResponseLength == 0 {
		return nil
	}
	return state
}

func attachCodexRequestTurnState(metadata *ResponseHeaderMetadata, record map[string]any) *ResponseHeaderMetadata {
	raw := record["codex_turn_state"]
	if raw == nil {
		return metadata
	}
	data, err := json.Marshal(raw)
	if err != nil {
		return metadata
	}
	// The queue object is exclusively request metadata. Response observations
	// are parsed from response_headers or imported response_metadata separately.
	var observation struct {
		RequestLength *int   `json:"request_length"`
		RequestSource string `json:"request_source"`
		RequestScope  string `json:"request_scope"`
	}
	if json.Unmarshal(data, &observation) != nil {
		return metadata
	}
	state := sanitizeCodexTurnState(&HeaderCodexTurnStateMetadata{
		RequestLength: observation.RequestLength,
		RequestSource: observation.RequestSource,
		RequestScope:  observation.RequestScope,
	})
	if state == nil {
		return metadata
	}
	return MergeResponseHeaderMetadata(metadata, &ResponseHeaderMetadata{CodexTurnState: state})
}
