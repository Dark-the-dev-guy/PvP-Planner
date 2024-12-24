import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import axios from "axios";
import "./App.css";

function App() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Fetch events from your API endpoint
    axios
      .get("https://your-backend-url.com/api/calendar")
      .then((response) => {
        setEvents(
          response.data.map((event) => ({
            title: `${event.gameMode.toUpperCase()} @ ${new Date(event.date).toLocaleTimeString()}`,
            start: event.date,
            id: event.sessionId,
            notes: event.notes,
          }))
        );
      })
      .catch((error) => console.error("Error fetching events:", error));
  }, []);

  const handleEventClick = (info) => {
    alert(
      `Session ID: ${info.event.id}\nNotes: ${info.event.extendedProps.notes}`
    );
  };

  return (
    <div className="App">
      <h1>PvP Planner Calendar</h1>
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        events={events}
        eventClick={handleEventClick}
      />
    </div>
  );
}

export default App;
