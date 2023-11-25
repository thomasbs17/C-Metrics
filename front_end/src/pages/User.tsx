import React, { useState } from 'react'
import { Form, Button } from 'react-bootstrap'

interface RegistrationFormData {
  username: string
  email: string
  password: string
}

function UserRegistrationForm () {
  const [formData, setFormData] = useState<RegistrationFormData>({
    username: '',
    email: '',
    password: ''
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    // Handle form submission here
    console.log('Submitted:', formData)
  }

  return (
    <div className="container mt-5">
      <h2>User Registration</h2>
      <Form onSubmit={handleSubmit}>
        <Form.Group controlId="username">
          <Form.Label>Username</Form.Label>
          <Form.Control
            type="text"
            placeholder="Enter username"
            value={formData.username}
            onChange={(e) => { setFormData({ ...formData, username: e.target.value }) }
            }
          />
        </Form.Group>

        <Form.Group controlId="email">
          <Form.Label>Email address</Form.Label>
          <Form.Control
            type="email"
            placeholder="Enter email"
            value={formData.email}
            onChange={(e) => { setFormData({ ...formData, email: e.target.value }) }
            }
          />
        </Form.Group>

        <Form.Group controlId="password">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => { setFormData({ ...formData, password: e.target.value }) }
            }
          />
        </Form.Group>
        <div className="mb-3" style={{ padding: '10px' }}>
          {' '}
          {/* Add Bootstrap utility class for spacing */}
          <Button variant="primary" type="submit">
            Register
          </Button>
        </div>
      </Form>
    </div>
  )
}

export default UserRegistrationForm
