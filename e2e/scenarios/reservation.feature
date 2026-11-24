Feature: Campus Resource Reservation Engine

  As a student
  I want to book a campus resource for a time slot
  So that the room or the equipment is mine when I arrive

  Background:
    Given the catalogue holds "Study Room 302", "Study Room 415" and "3D Printer A" as bookable
    And "Robotics Lab" is out of service
    And a student is on the CampusHub home page

  Scenario: Student successfully reserves an available study room
    When they filter the resources by type "ROOM"
    And they select "Study Room 302"
    And they submit a reservation for a free one-hour slot
    Then they should see a success message naming the new reservation
    And the reservation should appear in their "My bookings" list as PENDING

  Scenario: Student receives a conflict alert on a double booking
    Given a student has reserved "3D Printer A" for a one-hour slot
    When another student submits a reservation for "3D Printer A" in the same slot
    Then the system should display a conflict alert carrying the code "DOUBLE_BOOKING"
    And the second reservation should not appear in that student's "My bookings" list

  Scenario: Cancelling a booking releases the slot
    Given a student has reserved "Study Room 415" for a one-hour slot
    When they cancel that booking
    Then their "My bookings" list should be empty
    And another student should be able to reserve "Study Room 415" in the same slot

  Scenario: A resource that is out of service cannot be selected
    When they filter the resources by type "LAB"
    Then "Robotics Lab" should be listed as unavailable
    And its card should not be selectable
